function upload() {
    const form_upload = $('#form_upload');
    const form_data = new FormData(form_upload[0]);
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
            $('#seq_name').val(response['name']);
            $('#seq_content').val(response['sequence']);
            let bt_predict = $('#bt_predict')
            bt_predict.prop('disabled', false)
            bt_predict.addClass('btn-primary')
            bt_predict.removeClass('btn-secondary');
        })
        .catch(error => {
            console.error(error);
        });
}

function run() {
    const name = $('#seq_name').val();
    const sequence = $('#seq_content').val();

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
            $('#time_out').show();
            $('#prediction_url').val(window.location.href);
            $('#prediction').show();
            listener_status(data['computation_id']).then(r => console.log(`Listening to computation ${data['computation_id']}`));
        })
        .catch(error => {
            console.error(error);
        });
}

async function listener_status(computation_id) {
    const fileExists = file =>
        fetch(file, {method: 'HEAD', cache: 'no-store'})
            .then(response => ({200: true, 404: false})[response.status])
            .catch(exception => undefined);

    let yourFileExists = await fileExists(`/static/${computation_id}_predicted_structure.pdb`);

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

    let viewerContainer = document.getElementById('molstar');
    viewerInstance.render(viewerContainer, options);
}

function render_result(computation_id) {
    fetch(`/computation/${computation_id}/result`, {
        method: 'GET',
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Can't download a result");
            }
            $('#time_out').hide();
            $('#demo').hide();
            let iframe = $('#if_structure');
            // iframe.show();
            iframe.attr('src', `/static/${computation_id}_VisualizePDBs.html`);
            molstar(`/static/${computation_id}_predicted_structure.pdb`)
        })
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
            // $('#time_out').show();
            $('#prediction_url').val(window.location.href);
            $('#prediction').show();
            listener_status(computation_id).then(r => console.log('Checking the computation status'));
        } else {
            console.log('No Computation ID found');
        }
    }
}

$(document).ready(function () {
    listener_url();
});