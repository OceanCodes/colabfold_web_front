import os
import time

import requests
from aind_codeocean_api.codeocean import CodeOceanClient

co_api_token = os.getenv("CO_API_KEY")
co_domain = "https://acmecorp-demo.codeocean.com"
co_client = CodeOceanClient(domain=co_domain, token=co_api_token)

# API parameters
capsule_id = "cb2f63ba-2030-4929-92ae-91687ca6713e"
data_asset = [{"id": "e09a0db8-b682-4cb0-b9c6-0b7c93177777", "mount": "colabfold"}]


def run_capsule(sequence_name, aa_sequence, recycle_count='3'):
    # Run Capsule or Pipeline
    run_response = co_client.run_capsule(
        capsule_id=capsule_id,
        data_assets=data_asset,
        parameters=[sequence_name, aa_sequence, recycle_count]
    )
    return run_response.json()['id']


def get_computation_state(computation_id):
    computation_meta = co_client.get_computation(computation_id=computation_id).json()
    computation_state = computation_meta['state']
    while computation_state != 'completed':
        if computation_state == 'failed':
            raise SystemExit(f"Computation {computation_meta['id']} failed, exiting notebook.")
        time.sleep(5)
        computation_state = co_client.get_computation(computation_id=computation_id).json()['state']

    return computation_state


def get_result(computation_id, fp, path_to_file):
    res = co_client.get_result_file_download_url(computation_id, path_to_file).json()
    response = requests.get(res['url'])
    open(fp, 'wb').write(response.content)


def get_capsule_uid():
    capsule_meta = co_client.get_capsule(capsule_id).json()
    return {'name': capsule_meta['name'], 'slug': capsule_meta['slug']}


def create_asset(computation_id, asset_name, tags=None):
    if tags is None:
        tags = ["predicted structure", "colabfold"]

    asset = co_client.register_result_as_data_asset(computation_id, asset_name, asset_description="", tags=tags)
    return asset.json()
