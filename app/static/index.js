async function listener(computation_id) {
  const endpoint = `https://hostname.com/computation/${computation_id}/status`;
  let status = '';
  while (status !== 'completed') {
    const response = await fetch(endpoint);
    const json = await response.json();
    status = json.status;
    await new Promise(resolve => setTimeout(resolve, 5000)); // wait for 5 second before checking again
  }
  const file_path = '/path/to/folder/';
  const file_url = `https://hostname.com/computation/${computation_id}/structure.html`;
  await fetch(file_url)
    .then(response => response.text())
    .then(html => {
      const iframe = document.getElementById('structure');
      iframe.srcdoc = html;
    });
}


$(document).ready(function () {
});