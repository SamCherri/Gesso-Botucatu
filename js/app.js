document.getElementById('form-orcamento')?.addEventListener('submit', function(e){
  e.preventDefault();
  const form = e.currentTarget;
  const status = document.getElementById('status');
  const data = Object.fromEntries(new FormData(form));
  if (data.website) { status.textContent = 'OK'; return; } // honeypot
  status.textContent = 'Enviaremos ao Firebase na Fase 6.';
});