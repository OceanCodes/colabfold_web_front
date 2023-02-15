import os

from Bio import SeqIO
from flask import Flask, flash, request, redirect, render_template, url_for, send_from_directory, send_file, jsonify
from werkzeug.exceptions import abort
from werkzeug.utils import secure_filename

from app.co_api import run_capsule, get_computation_state, get_result

UPLOAD_FOLDER = './app/temp'
ALLOWED_EXTENSIONS = {'fa', 'fasta'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 10 * 1000


def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
            return redirect(url_for('download_file', name=filename))

    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload_file(name):
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
        full_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(full_path)
        fasta = next(SeqIO.parse(full_path, "fasta"))
        computation_id = run_capsule(fasta.id, str(fasta.seq))
        if get_computation_state(computation_id) == 'completed':
            get_result(computation_id, './app/temp/predicted_structure.pdb')
    return send_from_directory(app.config["UPLOAD_FOLDER"], name)


@app.errorhandler(404)
def page_not_found(error):
    return render_template('page_not_found.html'), 404


@app.route('/run_capsule', methods=['POST'])
def run_capsule():
    # retrieve name and sequence from request body
    name = request.json.get('name')
    sequence = request.json.get('sequence')

    # check if name and sequence were provided
    if not name or not sequence:
        abort(400, "Name and sequence must be provided")

    # generate unique ID for computation
    computation_id = str(uuid.uuid4())

    # create metadata dictionary for computation
    metadata = {
        'name': name,
        'sequence': sequence,
        'status': 'running'
    }

    # add computation to dictionary
    computations[computation_id] = metadata

    # run computation (placeholder code)
    result = 'placeholder result'

    # update metadata with result and status
    metadata['result'] = result
    metadata['status'] = 'completed'

    # return metadata as JSON response
    return jsonify({'id': computation_id, 'metadata': metadata}), 200


@app.route('/computation/<id>/', methods=['GET'])
def get_computation(id):
    # check if computation exists
    if id not in computations:
        abort(404, "Computation not found")

    # retrieve metadata for computation
    metadata = computations[id]

    # return metadata as JSON response
    return jsonify(metadata), 200


@app.route('/computation/<id>/file/', methods=['GET'])
def get_computation_file(id):
    # check if computation exists
    if id not in computations:
        abort(404, "Computation not found")

    # retrieve metadata for computation
    metadata = computations[id]

    # check if computation has a file
    if 'file_path' not in metadata:
        abort(404, "File not found")

    # retrieve file path and check if file exists
    file_path = metadata['file_path']
    if not os.path.exists(file_path):
        abort(404, "File not found")

    # return file as response
    return send_file(file_path, as_attachment=True)


@app.route('/computation/<id>/status', methods=['GET'])
def get_computation_status(id):
    # check if computation exists
    if id not in computations:
        abort(404, "Computation not found")

    # retrieve status for computation
    metadata = computations[id]
    status = metadata['status']

    # return status as JSON response
    return jsonify({'status': status}), 200
