import "server-only";
import { Transform, type TransformCallback } from "node:stream";
import { IncomingMessage } from "node:http";
import { NodeHttpHandler } from "@smithy/node-http-handler";
export interface AwsResponseBudget {
    remaining: number;
}
/** Owns actual native response streams before Smithy collection, including error bodies. */
export function boundedAwsHandler(parent: AbortSignal, budget: AwsResponseBudget, options: {
    maxBytes?: number;
    timeoutMs?: number;
    native?: NodeHttpHandler;
} = {}) {
    const native = options.native ?? new NodeHttpHandler({ connectionTimeout: 2000, requestTimeout: 6000, throwOnRequestTimeout: true });
    const active = new Set<() => void>();
    return {
        metadata: { handlerProtocol: "http/1.1" },
        async handle(request: Parameters<NodeHttpHandler['handle']>[0], call: Parameters<NodeHttpHandler['handle']>[1] = {}) {
            if (parent.aborted || budget.remaining <= 0)
                throw new Error('aws_response_unavailable');
            const controller = new AbortController();
            const abort = () => controller.abort();
            parent.addEventListener('abort', abort, { once: true });
            call.abortSignal?.addEventListener('abort', abort, { once: true });
            const timer = setTimeout(abort, options.timeoutMs ?? 6000);
            let source: IncomingMessage | undefined, bounded: Transform | undefined;
            const cleanup = () => { clearTimeout(timer); parent.removeEventListener('abort', abort); call.abortSignal?.removeEventListener('abort', abort); active.delete(stop); };
            const stop = () => { controller.abort(); source?.destroy(); bounded?.destroy(new Error('aws_response_unavailable')); cleanup(); };
            active.add(stop);
            controller.signal.addEventListener('abort', stop, { once: true });
            try {
                if (call.abortSignal?.aborted)
                    controller.abort();
                const result = await native.handle(request, { ...call, abortSignal: controller.signal });
                source = result.response.body;
                if (!(source instanceof IncomingMessage))
                    throw new Error('aws_response_unavailable');
                const limit = options.maxBytes ?? 512 * 1024;
                const lengths = source.rawHeaders.filter((_, index) => index % 2 === 0).filter(k => k.toLowerCase() === 'content-length');
                const length = result.response.headers['content-length'];
                if (lengths.length > 1 || (length !== undefined && (!/^\d+$/.test(length) || Number(length) > Math.min(limit, budget.remaining))) ||
                    (result.response.headers['content-encoding'] && result.response.headers['content-encoding'] !== 'identity') || result.response.statusCode >= 300 && result.response.statusCode < 400)
                    throw new Error('aws_response_unavailable');
                let received = 0;
                bounded = new Transform({ transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback) {
                        if (!Buffer.isBuffer(chunk) || controller.signal.aborted || received + chunk.length > limit || chunk.length > budget.remaining) {
                            budget.remaining = 0;
                            done(new Error('aws_response_unavailable'));
                            return;
                        }
                        received += chunk.length;
                        budget.remaining -= chunk.length;
                        done(null, chunk);
                    } });
                const body = bounded;
                source.once('error', () => body.destroy(new Error('aws_response_unavailable')));
                body.once('error', () => { source?.destroy(); controller.abort(); cleanup(); });
                body.once('end', () => { cleanup(); controller.signal.removeEventListener('abort', stop); });
                body.once('close', () => {
                    if (!body.readableEnded)
                        source?.destroy();
                    cleanup();
                });
                source.pipe(body);
                result.response.body = body;
                return result;
            }
            catch {
                stop();
                throw new Error('aws_response_unavailable');
            }
        },
        destroy() {
            for (const stop of [...active])
                stop();
            native.destroy();
        },
    };
}
/** Fixed reviewed service origins: never accept ambient endpoint URL configuration. */
export function awsReadEndpoint(service: 'sts' | 'ecs' | 'ecr', region: string, partition: string): string {
    if (!/^[a-z]{2}(?:-[a-z]+)+-[0-9]$/.test(region) || !['aws', 'aws-us-gov', 'aws-cn'].includes(partition) || (partition === 'aws-cn') !== region.startsWith('cn-') || (partition === 'aws-us-gov') !== region.startsWith('us-gov-'))
        throw new Error('aws_response_unavailable');
    return `https://${service === 'ecr' ? 'api.ecr' : service}.${region}.amazonaws.com${partition === 'aws-cn' ? '.cn' : ''}`;
}
