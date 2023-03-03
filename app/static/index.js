const $ = document.querySelector.bind(document)

function upload() {
    const form_upload = $('#form_upload');
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
            $('#seq_name').value = response['name'];
            $('#seq_content').value = response['sequence'];
            let bt_predict = $('#bt_predict');
            bt_predict.removeAttribute('disabled')
        })
        .catch(error => {
            console.error(error);
        });
}

function run() {
    const name = $('#seq_name').value;
    const sequence = $('#seq_content').value;

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
            $('#time_out').style.display = 'flex';
            $('#demo').play();
            // $('#overlay_predicting').style.display = 'flex';
            $('#progress_predicting').classList.toggle('d-none');
            start_progress_bar();
            $('#prediction_url').value = window.location.href;
            $('#prediction').style.display = 'flex';
            listener_status(data['computation_id']).then(r => console.log(`Listening to computation ${data['computation_id']}`));
        })
        .catch(error => {
            console.error(error);
        });
}

function reset_progress_bar() {
    let progress_bar = $('.progress-bar');
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
    let progress_bar = $('.progress-bar')
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
                // TODO What happens here?
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

    let viewerContainer = $('#molstar');
    viewerInstance.render(viewerContainer, options);
}

function download_uri(uri, filename) {
    let downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", uri);
    downloadAnchorNode.setAttribute("download", filename);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

async function create_asset(computation_id) {
    let seq_name = $('#text_asset_name').value;
    let bt_creat_asset = $('#bt_create_asset');
    bt_creat_asset.innerHTML = "<div class='spinner-border text-primary' role='status' style='height: 14px; width: 14px'></div> Creating the data asset"
    bt_creat_asset.setAttribute('disabled', 'true');
    const response = await fetch(`/computation/${computation_id}/create_asset`, {
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
            return response.json();
        })
    const asset_id = await response['asset_id'];
    $('#inp')
    console.log(`https://acmecorp-demo.codeocean.com/data-assets/${asset_id}/`)
}

function render_result(computation_id) {
    fetch(`/computation/${computation_id}/result`, {
        method: 'GET',
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Can't download a result");
            }
            $('#time_out').style.display = 'none';
            // $('#overlay_predicting').style.display = 'none';
            $('#progress_predicting').classList.toggle('d-none');
            $('#demo').style.display = 'none';
            $('#wrapper_molstar').classList.toggle('d-none');
            molstar(`/static/pdb/${computation_id}_predicted_structure.pdb`);
            $('#bt_download_pdb').onclick = () => {
                return download_uri(`/static/pdb/${computation_id}_predicted_structure.pdb`, `${computation_id}_predicted_structure.pdb`)
            };
            $('#bt_create_asset').onclick = () => {
                return create_asset(computation_id);
            }
            let bts_results = $('#bts_results');
            bts_results.classList.toggle('d-none');
        })
}

function copy_url() {
// Copies the URL to the clipboard
    let url = $("#prediction_url");
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
            // $('#time_out').style.display = 'block';
            $('#prediction_url').value = window.location.href;
            $('#prediction').style.display = 'flex';
            listener_status(computation_id).then(r => console.log('Checking the computation status'));
        } else {
            console.log('No Computation ID found');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    listener_url();
});