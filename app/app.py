import os
from flask import Flask, flash, request, redirect, render_template
from werkzeug.utils import secure_filename
from Bio import SeqIO
from app.co_api import run_capsule, get_computation_state, get_result

UPLOAD_FOLDER = './app/temp'
ALLOWED_EXTENSIONS = {'fa', 'fasta'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1000 * 1000


def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/', methods=['GET'])
@app.route('/computation/<computation_id>')
def index(computation_id=''):
    return render_template('index.html')


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
        full_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
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
    print(computation_id)
    if get_computation_state(computation_id) == 'completed':
        get_result(computation_id, './app/temp/predicted_structure.pdb')
    return


@app.route('/computation/<computation_id>/result', methods=['GET'])
def result():
    return


@app.errorhandler(404)
def page_not_found(error):
    return render_template('page_not_found.html'), 404
