function upload() {
    const form_upload = document.querySelector('#form_upload');
    const form_data = new FormData(form_upload);
    fetch('/upload', {
        method: 'POST',
        body: form_data
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Not a FASTA file");
            }
            return response.json()
        })
        .then(response => {
            console.log('uploaded')
            document.querySelector('#seq_name').value = response['name'];
            document.querySelector('#seq_content').value = response['sequence'];
            let bt_predict = document.querySelector('#bt_predict');
            bt_predict.removeAttribute('disabled')
        })
        .catch(error => {
            console.error(error);
        });
}

function run() {
    const name = document.querySelector('#seq_name').value;
    const sequence = document.querySelector('#seq_content').value;

    fetch('/run', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({name: name, sequence: sequence})
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Can't start a capsule with these parameters");
            }
            return response.json();
        })
        .then(data => {
            console.log(`Computation id: ${data['computation_id']}`)
            history.pushState({}, null, `computation/${data['computation_id']}`);
            document.querySelector('#time_out').style.display = 'flex';
            document.querySelector('#demo').play();
            document.querySelector('#overlay_predicting').style.display = 'flex';
            document.querySelector('#progress_predicting').style.display = 'flex';
            start_progress_bar();
            document.querySelector('#prediction_url').value = window.location.href;
            document.querySelector('#prediction').style.display = 'flex';
            listener_status(data['computation_id']).then(r => console.log(`Listening to computation ${data['computation_id']}`));
        })
        .catch(error => {
            console.error(error);
        });
}

function reset_progress_bar() {
    let progress_bar = document.querySelector('.progress-bar');
    progress_bar.style.width = '0%';
    progress_bar.setAttribute('aria-valuenow', 0);
    progress_bar.textContent = '0%';
}

function start_progress_bar() {
    // It’s challenging to estimate from the input how long the prediction would take
    // So we show a progress bar
    let current_progress = 0;
    let step = 0.01;
    let timeout = 100;
    let progress_bar = document.querySelector('.progress-bar')
    let interval = setInterval(function () {
        current_progress += step;
        let progress = (Math.round(Math.atan(current_progress) / (Math.PI / 2) * 100 * 1000) / 1000).toPrecision(4);
        progress_bar.style.width = `${progress}%`;
        progress_bar.setAttribute('aria-valuenow', progress);
        if (progress >= 100) {
            clearInterval(interval);
        } else if (progress >= 50) {
            // In case the protein is long
            timeout = 3000;
        } else if (progress >= 30) {
            // Computation
            timeout = 1000;
            progress_bar.textContent = 'Running colabfold 1.5.1'
        } else if (progress >= 15) {
            step = 0.001;
        } else if (progress >= 0) {
            // Starting a capsule
            step = 0.005;
            progress_bar.textContent = 'Starting the capsule';
        }
    }, timeout);
}

async function listener_status(computation_id) {
    const fileExists = file =>
        fetch(file, {method: 'HEAD', cache: 'no-store'})
            .then(response => ({200: true, 404: false})[response.status])
            .catch(exception => undefined);

    let yourFileExists = await fileExists(`/static/pdb/${computation_id}_predicted_structure.pdb`);

    if (yourFileExists) {
        console.log("PDB file already exist. Rendering")
        render_result(computation_id);
    } else if (yourFileExists === false) {
        console.log("PDB file doesn't exist yet. Listening")
        while (true) {


            const response = await fetch(`/computation/${computation_id}/status`);
            const data = await response.json();

            if (data.status === 'completed') {
                console.log('Computation completed')
                render_result(computation_id);
                break;
            }

            // Wait for 5 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}


function molstar(url) {
    let viewerInstance = new PDBeMolstarPlugin();
    let options = {
        customData: {
            url: url,
            format: 'pdb',
        },
        bgColor: {r: 255, g: 255, b: 255},
        hideControls: true,
    }

    let viewerContainer = document.querySelector('#molstar');
    viewerInstance.render(viewerContainer, options);
}

function download_uri(uri, filename) {
    let downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", uri);
    downloadAnchorNode.setAttribute("download", filename);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function create_asset(computation_id) {
    let seq_name = document.querySelector('#seq_name').value;
    let bt_creat_asset = document.querySelector('#bt_create_asset');
    bt_creat_asset.innerHTML = "<div class='spinner-border text-primary' role='status' style='height: 14px; width: 14px'></div> Creating the data asset"
    bt_creat_asset.setAttribute('disabled', 'true');
    fetch(`/computation/${computation_id}/create_asset`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({name: seq_name})
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Can't make a data asset");
            }
            bt_creat_asset.innerHTML = "<i class='fas fa-database' title='Create Data Asset from results' aria-hidden='true'></i> Data asset created";
            bt_creat_asset.classList.remove('btn-outline-primary');
            bt_creat_asset.classList.add('btn-outline-success');
        })
}

function render_result(computation_id) {
    fetch(`/computation/${computation_id}/result`, {
        method: 'GET',
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Can't download a result");
            }
            document.querySelector('#time_out').style.display = 'none';
            document.querySelector('#overlay_predicting').style.display = 'none';
            document.querySelector('#progress_predicting').style.display = 'none';
            document.querySelector('#demo').style.display = 'none';
            document.querySelector('#molstar').style.display = 'flex';
            molstar(`/static/pdb/${computation_id}_predicted_structure.pdb`);
            document.querySelector('#bt_download_pdb').onclick = () => {
                return download_uri(`/static/pdb/${computation_id}_predicted_structure.pdb`, `${computation_id}_predicted_structure.pdb`)
            };
            document.querySelector('#bt_create_asset').onclick = () => {
                return create_asset(computation_id);
            }
            let bts_results = document.querySelector('#bts_results');
            bts_results.classList.remove('d-none');
            bts_results.classList.add('d-flex');
        })
}

function copy_url() {
// Copies the URL to the clipboard
    let url = document.querySelector("#prediction_url");
    url.select();
    url.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(url.value);
}


function listener_url() {
    const url = window.location.href;

    if (url.endsWith("/computation")) {
        console.log('No Computation ID found');
    } else {
        // Not sure about this part - simple .split('/') should work too
        const re = /\/computation\/([a-z0-9_]+(-[a-z0-9_]+)*)$/; // regular expression to match "/computation/" followed by one or more word characters at the end of the string
        const match = re.exec(url); // attempt to match the regular expression to the URL
        if (match) {
            const computation_id = match[0].split('/')[2]; // extract the matched ID from the regular expression match
            console.log(`Computation ID found: ${computation_id}`);
            // document.querySelector('#time_out').style.display = 'block';
            document.querySelector('#prediction_url').value = window.location.href;
            document.querySelector('#prediction').style.display = 'flex';
            listener_status(computation_id).then(r => console.log('Checking the computation status'));
        } else {
            console.log('No Computation ID found');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    listener_url();
});