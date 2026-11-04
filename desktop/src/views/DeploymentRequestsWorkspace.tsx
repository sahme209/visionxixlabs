import {useRef,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import {DeploymentRequestsView} from './DeploymentRequestsView';

/** A departed desktop context must not retain Releases state or child panels.
 * Remounting does not cancel an already-dispatched save or provider operation. */
export function DeploymentRequestsWorkspace(){
 const config=useSyncExternalStore(desktopClient.subscribeContext,()=>desktopClient.config,()=>desktopClient.config);
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
 const owner=useRef({config,revision,generation:0});
 if(owner.current.config!==config||owner.current.revision!==revision)owner.current={config,revision,generation:owner.current.generation+1};
 return <DeploymentRequestsView key={owner.current.generation}/>;
}
