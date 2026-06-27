class DialogHelper {
  static show(options = {}) {
    return new Promise((resolve) => {
      const {
        title = 'Confirmation',
        message = 'Are you sure?',
        confirmText = 'Yes',
        cancelText = 'No',
        isInput = false,
        inputType = 'text',
        inputValue = '',
        inputPlaceholder = '',
        confirmClass = 'btn-danger'
      } = options;

      // Overlay
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';

      // Box
      const box = document.createElement('div');
      box.className = 'dialog-box';

      let inputHtml = '';
      if (isInput) {
        inputHtml = `<div class="dialog-input-wrapper">
          <input type="${inputType}" class="dialog-input form-control" value="${inputValue}" placeholder="${inputPlaceholder}" id="dialog-input-field">
        </div>`;
      }

      box.innerHTML = `
        <div class="dialog-header">
          <h3>${title}</h3>
          <button class="dialog-close-btn">&times;</button>
        </div>
        <div class="dialog-body">
          <p>${message}</p>
          ${inputHtml}
        </div>
        <div class="dialog-footer">
          ${cancelText ? `<button class="btn btn-secondary dialog-cancel-btn">${cancelText}</button>` : ''}
          <button class="btn ${confirmClass} dialog-confirm-btn">${confirmText}</button>
        </div>
      `;

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // Focus
      setTimeout(() => {
        if (isInput) {
          const field = document.getElementById('dialog-input-field');
          if (field) {
            field.focus();
            field.select();
          }
        } else {
          box.querySelector('.dialog-confirm-btn').focus();
        }
        overlay.classList.add('active');
      }, 50);

      // Clean up & resolve
      const close = (result) => {
        overlay.classList.remove('active');
        overlay.addEventListener('transitionend', () => {
          overlay.remove();
        });
        resolve(result);
      };

      // Events
      const onConfirm = () => {
        if (isInput) {
          const val = document.getElementById('dialog-input-field').value;
          close(val);
        } else {
          close(true);
        }
      };

      const onCancel = () => {
        close(false);
      };

      box.querySelector('.dialog-confirm-btn').addEventListener('click', onConfirm);
      if (cancelText) {
        box.querySelector('.dialog-cancel-btn').addEventListener('click', onCancel);
      }
      box.querySelector('.dialog-close-btn').addEventListener('click', onCancel);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) onCancel();
      });

      // Escape & Enter
      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', keyHandler);
          onCancel();
        } else if (e.key === 'Enter') {
          if (e.target.tagName !== 'TEXTAREA') {
            document.removeEventListener('keydown', keyHandler);
            onConfirm();
          }
        }
      };
      document.addEventListener('keydown', keyHandler);
    });
  }

  static confirm(message, title = 'Confirm Action', confirmClass = 'btn-primary') {
    return this.show({
      title,
      message,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      confirmClass
    });
  }

  static alert(message, title = 'Notification') {
    return this.show({
      title,
      message,
      confirmText: 'OK',
      cancelText: '',
      confirmClass: 'btn-primary'
    }).then(() => true);
  }

  static prompt(message, defaultValue = '', title = 'Input Required', placeholder = '') {
    return this.show({
      title,
      message,
      confirmText: 'Submit',
      cancelText: 'Cancel',
      isInput: true,
      inputValue: defaultValue,
      inputPlaceholder: placeholder,
      confirmClass: 'btn-primary'
    });
  }
}

window.Dialog = DialogHelper;
export default DialogHelper;
