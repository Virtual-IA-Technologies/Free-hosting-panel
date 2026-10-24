/* Public login presentation only; native forms, tokens and 2FA remain intact. */
(() => {
  const app = document.querySelector('.page-login .app, .page-reset .app');
  if (!app || document.querySelector('.via-login-intro')) return;
  const section = document.createElement('section');
  section.className = 'via-login-intro';
  const add = (tag, cls, text) => {
    const e = document.createElement(tag); e.className = cls; e.textContent = text;
    section.append(e);
  };
  add('p', 'via-login-eyebrow', 'VIRTUAL IA PANEL / ACCESO VIP');
  add('h2', 'via-login-headline', 'Tu infraestructura,\nen un solo lugar.');
  add('p', 'via-login-description', 'Gestiona cuentas, sitios y servicios desde un entorno claro, seguro y conectado.');
  add('p', 'via-login-topics', 'Hosting  ·  Servicios  ·  Seguridad');
  app.prepend(section);
  const submit=app.querySelector('#login-form button[type="submit"]');
  if(submit&&app.querySelector('#password')){const icon=submit.querySelector('i');submit.replaceChildren();if(icon)submit.append(icon);submit.append(document.createTextNode('Iniciar sesión'));}
})();
