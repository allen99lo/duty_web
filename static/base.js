var currentFile = (function() {
    var sel = document.getElementById('fileSelect');
    return sel && sel.value ? sel.value : '';
})();

function onFileChange(val) {
    currentFile = val;
    if (typeof loadSchedule === 'function') loadSchedule();
}
