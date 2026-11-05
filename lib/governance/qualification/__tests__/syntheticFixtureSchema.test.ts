import {it,expect} from 'vitest';
import {splitSyntheticFixtureSql} from '../syntheticFixtureSchema';
it('splits actual schema syntax without splitting quoted/comment/dollar semicolons',()=>{expect(splitSyntheticFixtureSql('CREATE TABLE "x;y"(v text DEFAULT \';\'); -- ;\nCREATE FUNCTION f() RETURNS void AS $$ BEGIN; END; $$ LANGUAGE plpgsql;')).toHaveLength(2);expect(()=>splitSyntheticFixtureSql("SELECT 'unterminated")).toThrow();});
