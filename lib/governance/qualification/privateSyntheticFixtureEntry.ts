/** Fixed installed administrative process main; never imported by app/runtime. */
import {runFixedSyntheticFixtureProducer} from './privateSyntheticFixtureProducer';
void runFixedSyntheticFixtureProducer().catch(()=>{process.exitCode=1;});
