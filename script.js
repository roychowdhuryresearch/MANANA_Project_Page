document.querySelector('#copy-bib').addEventListener('click', async () => {
  const bib = document.querySelector('#bib');
  const status = document.querySelector('#copied');
  try {
    await navigator.clipboard.writeText(bib.textContent);
    status.textContent = 'Copied';
    setTimeout(() => { status.textContent = ''; }, 3000);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(bib);
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    status.textContent = 'Selected — press Ctrl+C or ⌘C';
  }
});
