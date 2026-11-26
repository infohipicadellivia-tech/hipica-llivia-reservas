(() => {
  let recoveryMode = false;

  function installForgotPassword() {
    const loginForm = document.querySelector('#loginForm');
    if (!loginForm || document.querySelector('#forgotPasswordBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'forgotPasswordBtn';
    btn.type = 'button';
    btn.className = 'ghost';
    btn.textContent = 'He olvidado mi contraseña';
    btn.style.width = '100%';
    btn.style.marginTop = '8px';
    btn.addEventListener('click', showForgotPassword);
    loginForm.appendChild(btn);
  }

  function showForgotPassword() {
    const email = prompt('Indica el email de tu cuenta:');
    if (!email) return;
    sendReset(email.trim().toLowerCase());
  }

  async function sendReset(email) {
    if (!email || !email.includes('@')) return toast('Indica un email válido.');

    // Redirige de nuevo a la misma aplicación; Supabase emitirá PASSWORD_RECOVERY.
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      console.error(error);
      return toast('No se pudo solicitar el cambio de contraseña.');
    }

    alert('Si existe una cuenta con ese email, recibirás un enlace para cambiar la contraseña. Revisa también la carpeta de correo no deseado.');
  }

  async function showRecoveryForm() {
    if (recoveryMode) return;
    recoveryMode = true;

    const root = document.querySelector('#authView') || document.querySelector('main') || document.body;
    const card = document.createElement('div');
    card.id = 'passwordRecoveryCard';
    card.className = 'card';
    card.innerHTML = `
      <h2>Nueva contraseña</h2>
      <p class="muted">Introduce una nueva contraseña para tu cuenta.</p>
      <label>Nueva contraseña
        <input id="newPassword" type="password" autocomplete="new-password" minlength="8">
      </label>
      <label>Repetir contraseña
        <input id="newPassword2" type="password" autocomplete="new-password" minlength="8">
      </label>
      <button id="saveNewPassword" class="primary" type="button">Guardar nueva contraseña</button>
    `;
    root.prepend(card);

    document.querySelector('#saveNewPassword').addEventListener('click', updatePassword);
  }

  async function updatePassword() {
    const p1 = document.querySelector('#newPassword').value;
    const p2 = document.querySelector('#newPassword2').value;

    if (p1.length < 8) return toast('La contraseña debe tener al menos 8 caracteres.');
    if (p1 !== p2) return toast('Las contraseñas no coinciden.');

    const btn = document.querySelector('#saveNewPassword');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    const { error } = await db.auth.updateUser({ password: p1 });

    btn.disabled = false;
    btn.textContent = 'Guardar nueva contraseña';

    if (error) {
      console.error(error);
      return toast('No se pudo actualizar la contraseña.');
    }

    alert('Contraseña actualizada correctamente. Ya puedes iniciar sesión con la nueva contraseña.');
    recoveryMode = false;
    document.querySelector('#passwordRecoveryCard')?.remove();
    await db.auth.signOut();
    window.location.href = `${window.location.origin}${window.location.pathname}`;
  }

  db.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      setTimeout(showRecoveryForm, 0);
    }
  });

  const observer = new MutationObserver(installForgotPassword);
  observer.observe(document.body, { childList: true, subtree: true });
  installForgotPassword();
})();
