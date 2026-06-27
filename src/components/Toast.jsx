class ToastHelper {
  static show(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-card toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close-btn">&times;</button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close-btn');
    const dismiss = () => {
      if (toast.classList.contains('toast-dismissing')) return;
      toast.classList.add('toast-dismissing');
      toast.addEventListener('transitionend', () => {
        toast.remove();
        if (container.childElementCount === 0) {
          container.remove();
        }
      });
    };

    closeBtn.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  }

  static success(msg, dur) { this.show(msg, 'success', dur); }
  static error(msg, dur) { this.show(msg, 'error', dur); }
  static warn(msg, dur) { this.show(msg, 'warning', dur); }
  static info(msg, dur) { this.show(msg, 'info', dur); }
}

window.Toast = ToastHelper;
export default ToastHelper;
