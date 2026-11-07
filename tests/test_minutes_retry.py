"""専用インメモリDB。Firebase認証は依存差替え、実DBや外部サービスは使わない。"""
import os
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['FIREBASE_CREDENTIALS_PATH'] = 'unused-test-key.json'
import unittest
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.dependencies import require_user
from app.models import Team, User, Minute, Decision, Todo
from app.routers.minutes import router

class RetryReadTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        a,b = Team(name='retry-test-A'),Team(name='retry-test-B')
        self.db.add_all([a,b]);self.db.flush()
        u = User(firebase_uid='retry-test-user',team_id=a.id,name='test',role='member')
        self.db.add(u);self.db.flush()
        def minute(team, summary):
            return Minute(team_id=team,title='retry test',content='test only',meeting_at=datetime(2026,10,26,15,30,tzinfo=timezone.utc),summary=summary,created_by=u.id)
        own,other,draft = minute(a.id,'confirmed'),minute(b.id,'confirmed'),minute(a.id,None)
        self.db.add_all([own,other,draft]);self.db.commit()
        self.own,self.other,self.draft = own.id,other.id,draft.id
        self.claims={'uid':u.firebase_uid}
        app=FastAPI();app.include_router(router)
        app.dependency_overrides[get_db]=lambda:self.db
        def auth():
            if self.claims is None:raise HTTPException(401)
            return self.claims
        app.dependency_overrides[require_user]=auth
        self.client=TestClient(app)
    def tearDown(self):
        self.client.close();self.db.close();self.engine.dispose()
    def get(self,id):return self.client.get('/api/minutes/'+str(id))
    def counts(self):return [self.db.scalar(select(func.count()).select_from(m)) for m in [Minute,Decision,Todo]]
    def test_confirmed_read_does_not_write(self):
        before=self.counts()
        for _ in range(2):
            r=self.get(self.own);self.assertEqual(r.status_code,200);self.assertEqual(r.json()['content'],'test only')
        self.assertEqual(before,self.counts())
    def test_other_team_and_missing_hidden(self):
        self.assertEqual(self.get(self.other).status_code,404)
        self.assertEqual(self.get(uuid4()).status_code,404)
    def test_unconfirmed(self):self.assertEqual(self.get(self.draft).status_code,409)
    def test_invalid_id(self):self.assertEqual(self.get('invalid').status_code,422)
    def test_no_session(self):
        self.claims=None;self.assertEqual(self.get(self.own).status_code,401)
    def test_not_member(self):
        self.claims={'uid':'unregistered'};self.assertEqual(self.get(self.own).status_code,403)
    def test_invalid_claims(self):
        self.claims={};self.assertEqual(self.get(self.own).status_code,401)

if __name__=='__main__':unittest.main()
