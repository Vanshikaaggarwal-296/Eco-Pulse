import pytest
from fastapi.testclient import TestClient
from backend.main import app

@pytest.fixture(scope='module')
def client():
    with TestClient(app) as session:
        yield session

@pytest.mark.parametrize('building',['campus_a','hospital_a'])
@pytest.mark.parametrize('horizon',[24,48])
def test_predictions(client, building, horizon):
    response=client.get('/api/v1/dashboard',params={'building_id':building,'horizon':horizon})
    assert response.status_code==200
    data=response.json()
    assert data['source']=='synthetic'
    assert len(data['forecast'])==horizon
    assert len(data['history'])==24
    assert data['forecast'][0]['timestamp']>data['history'][-1]['timestamp']
    for row in data['forecast']:
        assert row['building_id']==building
        for target in ['demand_kw','occupancy','solar_kw']:
            assert 0<=row[target+'_p05']<=row[target+'_p50']<=row[target+'_p95']
    assert sum(d['demand_kwh'] for d in data['daily'])==pytest.approx(data['summary']['forecast_demand_kwh'])
    assert all(a['building_id']==building for a in data['alerts'])

@pytest.mark.parametrize('horizon',[0,49,-1,'bad'])
def test_bad_horizon(client,horizon):
    assert client.get('/api/v1/dashboard',params={'horizon':horizon}).status_code==422

def test_unknown_building(client):
    assert client.get('/api/v1/dashboard?building_id=missing').status_code==404

def test_injected_anomalies(client):
    data=client.get('/api/v1/dashboard').json()
    assert any(a['reason']=='battery_soc_out_of_range' for a in data['alerts'])
    assert any(a['signal']=='demand_kw' and a['value']==1000 for a in data['alerts'])

@pytest.mark.parametrize('name',['history','hourly','daily','evaluation','alerts','anomaly-readings'])
def test_download(client,name):
    response=client.get('/api/v1/download/'+name)
    assert response.status_code==200
    assert 'attachment' in response.headers['content-disposition']
    assert len(response.content)>50

def test_unknown_download(client):
    assert client.get('/api/v1/download/secrets').status_code==404

def test_serves_gui(client):
    response=client.get('/')
    assert response.status_code==200
    assert '<div id="root">' in response.text

def test_solar_day_and_night(client):
    import pandas as pd
    data=client.get('/api/v1/dashboard').json()
    forecast=pd.DataFrame(data['forecast'])
    hours=pd.to_datetime(forecast.timestamp,utc=True).dt.tz_convert('Asia/Kolkata').dt.hour
    assert forecast.loc[hours.between(9,16),'solar_kw_p50'].min()>10
    assert (forecast.loc[(hours<=6)|(hours>=18),'solar_kw_p95']==0).all()
    assert data['summary']['forecast_solar_kwh']>100
