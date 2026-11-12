import {it,expect} from 'vitest';
import {answerQuestion,buildIndex} from '../answerKernel';
import {knowledgeEntries} from '../knowledgeBase';
it.each(['How do offline customer-hosted models use operator token budgets?','Which offline AI operations have cloud fallback?'])('cites the offline operation guide for %s',question=>{
 const answer=answerQuestion(buildIndex(knowledgeEntries()),question);expect(answer.status).toBe('answered');if(answer.status==='answered')expect(answer.sources[0]?.href.split('#')[0]).toBe('/docs/offline-ai');
});
