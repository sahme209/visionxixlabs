import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ConnectedActionIntent} from './connectedActionContract';
export const connectedActionId=(intent:ConnectedActionIntent)=>'connected_action_'+sha256ContentHash({organizationId:intent.organizationId,intentId:intent.intentId});
