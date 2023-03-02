import json
import os

from Bio import SeqIO
from flask import Flask, flash, request, redirect, render_template
from werkzeug.utils import secure_filename

from app.co_api import run_capsule, get_computation_state, get_result, create_asset, get_capsule_uid

UPLOAD_FOLDER = './app/static'
FOLDER_FASTA = f'{UPLOAD_FOLDER}/fasta'
FOLDER_PDB = f'{UPLOAD_FOLDER}/pdb'
ALLOWED_EXTENSIONS = {'fa', 'fasta', 'faa'}

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1000


def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/', methods=['GET'])
@app.route('/computation/<computation_id>')
def index(computation_id=''):
    return render_template('index.html', meta=get_capsule_uid())


@app.route('/upload', methods=['POST'])
def upload():
    # check if the post request has the file part
    if 'file' not in request.files:
        flash('No file part')
        return redirect(request.url)
    file = request.files['file']
    # If the user does not select a file, the browser submits an
    # empty file without a filename.
    if file.filename == '':
        flash('No selected file')
        return redirect(request.url)

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        full_path = os.path.join(FOLDER_FASTA, filename)
        file.save(full_path)
        fasta = next(SeqIO.parse(full_path, "fasta"))
        return {'name': fasta.id, 'sequence': str(fasta.seq)}


@app.route('/run', methods=['POST'])
def run():
    # Returns computation_id from CO API
    name = request.json.get('name')
    sequence = request.json.get('sequence')
    return {'computation_id': run_capsule(name, sequence)}


@app.route('/computation/<computation_id>/status', methods=['GET'])
def status(computation_id):
    state = get_computation_state(computation_id)
    return json.dumps({'success': True, 'status': state}), 200, {'ContentType': 'application/json'}


@app.route('/computation/<computation_id>/result', methods=['GET'])
def result(computation_id):
    get_result(computation_id, f"{FOLDER_PDB}/{computation_id}_predicted_structure.pdb", 'predicted_structure.pdb')
    return json.dumps({'success': True, 'path': f"{FOLDER_PDB}/{computation_id}_predicted_structure.pdb"}), 200, {
        'ContentType': 'application/json'}


@app.route('/computation/<computation_id>/create_asset', methods=['POST'])
def asset(computation_id):
    name = request.json.get('name') or computation_id
    asset_id = create_asset(computation_id, name)['id']
    return json.dumps({'success': True, 'asset_id': asset_id}), 200, {'ContentType': 'application/json'}


@app.errorhandler(404)
def page_not_found(error):
    return render_template('page_not_found.html'), 404
