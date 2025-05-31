/* eslint-disable no-param-reassign */

// Cache DOM elements for better performance
const UI = {
  auth: {
    btn: document.getElementById('authorizeBtn'),
    status: document.getElementById('authStatus'),
    modal: {
      element: document.getElementById('authModal'),
      status: document.getElementById('authStatusModal'),
    },
    openModalBtn: document.getElementById('openAuthModalBtn'),
    channelInput: document.getElementById('channelIdInput'),
    channelHelp: document.getElementById('channelIdHelp'),
    credentialsInput: document.getElementById('credentialsFileInput'), // Changed from 'credentialsInput'
    uploadCredentialsBtn: document.getElementById('uploadCredentialsBtn'),
    credentialsStatus: document.getElementById('credentialsStatus'),
  },
  comments: {
    getBtn: document.getElementById('getCommentsBtn'),
    deleteAllBtn: document.getElementById('deleteAllBtn'),
    totalEl: document.getElementById('totalComments'),
    spamCountEl: document.getElementById('spamCount'),
    countEl: document.getElementById('commentCount'),
    spamBadgeEl: document.getElementById('spamBadge'),
    allContainer: document.getElementById('allComments'),
    spamContainer: document.getElementById('spamComments'),
  },
  progress: {
    bar: document.getElementById('scanProgress'),
    indicator: document
      .getElementById('scanProgress')
      ?.querySelector('.progress-bar'),
  },
  toast: {
    container: document.querySelector('.toast-container'),
  },
};

// Application state
const state = {
  isAuthorized: false,
  channelId: '',
  authModal: null,
  processingComments: false,
};

// Helper utilities
const utils = {
  // Create a toast notification
  createToast(message, type = 'error') {
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${type} border-0`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    // Choose icon based on type
    const icon =
      type === 'success'
        ? 'bi-check-circle-fill'
        : 'bi-exclamation-triangle-fill';

    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <i class="bi ${icon} me-2"></i>
          <span>${message}</span>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;

    if (!UI.toast.container) {
      // Create container if it doesn't exist
      const container = document.createElement('div');
      container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(container);
      UI.toast.container = container;
    }

    UI.toast.container.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
    toast.show();

    // Remove the element after it's hidden
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  },

  // Show success toast
  showSuccess(message) {
    this.createToast(message, 'success');
  },

  // Show error toast
  showError(message) {
    this.createToast(message, 'danger');
  },

  // Create empty state placeholder
  createEmptyState(icon, message) {
    return `
      <div class="text-center p-4 text-muted">
        <i class="bi ${icon} fs-1 mb-2"></i>
        <p>${message}</p>
      </div>
    `;
  },
};

// UI Rendering methods
const renderer = {
  // Update progress bar
  updateProgress(percentage) {
    if (!UI.progress.indicator) return;
    UI.progress.indicator.style.width = `${percentage}%`;
  },

  showProgress() {
    if (!UI.progress.bar) return;
    UI.progress.bar.classList.remove('d-none');
    this.updateProgress(10);
  },

  hideProgress() {
    if (!UI.progress.bar) return;
    this.updateProgress(100);
    setTimeout(() => {
      UI.progress.bar.classList.add('d-none');
      this.updateProgress(0);
    }, 500);
  },

  // Update counters
  updateCounters(allComments, spamComments) {
    const totalCount = allComments.length;
    const spamCount = Object.keys(spamComments).length;

    UI.comments.totalEl.textContent = totalCount;
    UI.comments.spamCountEl.textContent = spamCount;
    UI.comments.countEl.textContent = totalCount;
    UI.comments.spamBadgeEl.textContent = spamCount;

    // Enable/disable delete button
    if (spamCount > 0) {
      UI.comments.deleteAllBtn.classList.remove('disabled');
    } else {
      UI.comments.deleteAllBtn.classList.add('disabled');
    }
  },

  // Render normal comments
  renderComments(comments) {
    const container = UI.comments.allContainer;
    if (!container) return;

    container.innerHTML = '';

    if (!comments || comments.length === 0) {
      container.innerHTML = utils.createEmptyState(
        'bi-chat-square-text',
        'No comments found',
      );
      return;
    }

    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();

    comments.forEach((comment) => {
      const item = document.createElement('div');
      item.className = 'list-group-item p-3';

      const text = document.createElement('p');
      text.className = 'mb-0';
      text.textContent = comment;

      item.appendChild(text);
      fragment.appendChild(item);
    });

    container.appendChild(fragment);
  },

  // Render spam comments
  renderSpamComments(spamComments) {
    const container = UI.comments.spamContainer;
    if (!container) return;

    container.innerHTML = '';

    if (!spamComments || Object.keys(spamComments).length === 0) {
      container.innerHTML = utils.createEmptyState(
        'bi-lightning-charge-fill',
        'No <span class="zeus-icon">Zeus</span> spam comments found yet',
      );
      return;
    }

    const fragment = document.createDocumentFragment();

    Object.entries(spamComments).forEach(([id, data]) => {
      const item = document.createElement('div');
      item.className = 'list-group-item p-3';
      item.dataset.id = id;

      item.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <small class="text-muted">${id}</small>
          <button class="btn btn-sm btn-outline-danger delete-btn" data-comment-id="${id}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <p class="mb-0">${data.text}</p>
      `;

      fragment.appendChild(item);
    });

    container.appendChild(fragment);
  },

  // Update auth status UI
  updateAuthStatus(isAuthorized) {
    state.isAuthorized = isAuthorized;

    if (isAuthorized) {
      // Main status badge
      if (UI.auth.status) {
        UI.auth.status.textContent = 'Authorized';
        UI.auth.status.className = 'badge bg-success p-2';
      }

      // Modal status (if exists)
      if (UI.auth.modal.status) {
        UI.auth.modal.status.textContent = 'Authorized';
        const alertEl = UI.auth.modal.status.closest('.alert');
        if (alertEl) alertEl.className = 'alert alert-success mb-3';
      }

      // Enable functionality
      UI.comments.getBtn?.classList.remove('disabled');
    } else {
      // Main status badge
      if (UI.auth.status) {
        UI.auth.status.textContent = 'Not Authorized';
        UI.auth.status.className = 'badge bg-danger p-2';
      }

      // Modal status (if exists)
      if (UI.auth.modal.status) {
        UI.auth.modal.status.textContent = 'Not authorized';
        const alertEl = UI.auth.modal.status.closest('.alert');
        if (alertEl) alertEl.className = 'alert alert-info mb-3';
      }

      // Disable functionality
      UI.comments.getBtn?.classList.add('disabled');
    }
  },
};

// API Handlers
const api = {
  // Check if user is authorized
  async checkAuth() {
    try {
      const result = await window.youtubeApi.checkAuthorization();
      renderer.updateAuthStatus(result.authenticated);

      if (!result.authenticated && state.authModal) {
        state.authModal.show();
      }

      return result.authenticated;
    } catch (error) {
      console.error('Auth check error:', error);
      utils.showError('Failed to check authorization status');
      return false;
    }
  },

  // Authorize user
  async authorize(channelId) {
    if (!channelId) {
      utils.showError('Please enter your YouTube Channel ID');
      return false;
    }

    try {
      // Save channel ID first
      await window.youtubeApi.setChannelId(channelId);

      // Then authorize
      const result = await window.youtubeApi.authorize();
      renderer.updateAuthStatus(result.authenticated);

      if (result.authenticated) {
        state.channelId = channelId;
        utils.showSuccess('Successfully authorized with YouTube!');
        return true;
      } else {
        utils.showError('Authorization failed. Please try again.');
        return false;
      }
    } catch (error) {
      console.error('Auth error:', error);
      utils.showError(
        `Authorization error: ${error.message || 'Unknown error'}`,
      );
      return false;
    }
  },

  // Get comments
  async getComments() {
    if (state.processingComments) return;

    state.processingComments = true;
    renderer.showProgress();
    renderer.updateProgress(30);

    try {
      const result = await window.youtubeApi.getYoutubeContentList();
      renderer.updateProgress(70);

      if (!result.error) {
        const { allComments, spamComments } = result;

        // Update UI
        renderer.updateCounters(allComments, spamComments);
        renderer.renderComments(allComments);
        renderer.renderSpamComments(spamComments);
        return true;
      } else {
        utils.showError(result.error || 'Failed to fetch comments');
        return false;
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      utils.showError(
        `Error fetching comments: ${error.message || 'Unknown error'}`,
      );
      return false;
    } finally {
      state.processingComments = false;
      renderer.hideProgress();
    }
  },

  // Delete single comment
  async deleteComment(commentId) {
    const button = document.querySelector(
      `.delete-btn[data-comment-id="${commentId}"]`,
    );

    try {
      if (button) {
        button.disabled = true;
        button.innerHTML =
          '<span class="spinner-border spinner-border-sm"></span>';
      }

      await window.youtubeApi.deleteComments([commentId]);
      await this.getComments();
      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      utils.showError(
        `Error deleting comment: ${error.message || 'Unknown error'}`,
      );

      // Reset button
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-trash"></i>';
      }
      return false;
    }
  },

  // Delete all spam comments
  async deleteAllSpam() {
    const commentIds = Array.from(
      document.querySelectorAll('#spamComments .delete-btn'),
    ).map((btn) => btn.dataset.commentId);

    if (commentIds.length === 0) return true;

    try {
      const deleteBtn = UI.comments.deleteAllBtn;
      if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML =
          '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Banishing...';
      }

      await window.youtubeApi.deleteComments(commentIds);
      await this.getComments();
      return true;
    } catch (error) {
      utils.showError(
        `Error deleting spam comments: ${error.message || 'Unknown error'}`,
      );
      console.error('Error deleting all comments:', error);
      return false;
    } finally {
      const deleteBtn = UI.comments.deleteAllBtn;
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML =
          '<i class="bi bi-lightning-charge me-2"></i>Banish All <span class="zeus-icon">Zeus</span> Spam';
      }
    }
  },
};

// Event handlers
const handlers = {
  // Handle auth button click
  async handleAuthClick() {
    const authBtn = UI.auth.btn;
    const channelId = UI.auth.channelInput?.value.trim();

    if (!channelId) {
      utils.showError('Please enter your YouTube Channel ID');
      return;
    }

    // Check if user has uploaded credentials
    const credentialsStatus = UI.auth.credentialsStatus;
    if (
      credentialsStatus.classList.contains('d-none') ||
      !credentialsStatus.classList.contains('alert-success')
    ) {
      utils.showError('Please upload your Google API credentials first');
      return;
    }

    if (authBtn) {
      authBtn.disabled = true;
      authBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Authorizing...';
    }

    const success = await api.authorize(channelId);

    if (success && state.authModal) {
      state.authModal.hide();
    }

    // Reset button
    if (authBtn) {
      authBtn.disabled = false;
      authBtn.innerHTML =
        '<i class="bi bi-shield-lock me-2"></i>Authorize with YouTube';
    }
  },

  // Handle get comments button click
  async handleGetCommentsClick() {
    if (!state.isAuthorized) {
      utils.showError('Please authorize with YouTube first');
      return;
    }

    await api.getComments();
  },

  // Handle delete all spam button click
  async handleDeleteAllClick() {
    await api.deleteAllSpam();
  },

  // Handle single comment delete
  async handleCommentDeleteClick(e) {
    const deleteBtn = e.target.closest('.delete-btn');
    if (!deleteBtn) return;

    const commentId = deleteBtn.dataset.commentId;
    await api.deleteComment(commentId);
  },

  // Handle open modal button
  handleOpenModalClick() {
    if (state.authModal) {
      state.authModal.show();
    }
  },

  async handleCredentialsUpload() {
    const fileInput = UI.auth.credentialsInput;

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      const file = fileInput.files[0];
      console.log('Selected file:', file);
      utils.showError('Please select a credentials file');
      return;
    }

    const file = fileInput.files[0];
    console.log('Selected file:', file);
    const uploadBtn = UI.auth.uploadCredentialsBtn;

    try {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span>';

      // Read file content
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });

      // Validate JSON format
      let credentials;
      try {
        credentials = JSON.parse(fileContent);

        // Basic validation that it's a Google OAuth credentials file
        if (
          !credentials.installed ||
          !credentials.installed.client_id ||
          !credentials.installed.client_secret
        ) {
          throw new Error('Invalid Google API credentials file');
        }
      } catch (parseError) {
        utils.showError(
          'Invalid credentials file format. Please upload a valid Google API JSON file.',
        );
        return;
      }

      // Upload credentials to main process
      const result = await window.youtubeApi.uploadCredentials(credentials);

      if (result.success) {
        // Show success status
        UI.auth.credentialsStatus.textContent =
          'Credentials uploaded successfully';
        UI.auth.credentialsStatus.className =
          'd-block mt-2 alert alert-success';

        // Enable the authorize button if channel ID is also filled
        if (UI.auth.channelInput.value.trim()) {
          UI.auth.btn.disabled = false;
        }

        utils.showSuccess('Credentials uploaded successfully');
      } else {
        UI.auth.credentialsStatus.textContent =
          result.error || 'Failed to upload credentials';
        UI.auth.credentialsStatus.className = 'd-block mt-2 alert alert-danger';

        utils.showError(result.error || 'Failed to upload credentials');
      }
    } catch (error) {
      console.error('Error uploading credentials:', error);
      utils.showError(
        `Error uploading credentials: ${error.message || 'Unknown error'}`,
      );
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<i class="bi bi-upload"></i> Upload';
    }
  },
};

// Initialize the application
function initApp() {
  // Initialize Bootstrap components
  if (document.getElementById('authModal')) {
    state.authModal = new bootstrap.Modal(document.getElementById('authModal'));
  }

  // Initialize event listeners
  UI.auth.btn?.addEventListener('click', handlers.handleAuthClick);
  UI.auth.openModalBtn?.addEventListener(
    'click',
    handlers.handleOpenModalClick,
  );
  UI.comments.getBtn?.addEventListener(
    'click',
    handlers.handleGetCommentsClick,
  );
  UI.comments.deleteAllBtn?.addEventListener(
    'click',
    handlers.handleDeleteAllClick,
  );

  // Add event delegation for comment delete buttons
  UI.comments.spamContainer?.addEventListener(
    'click',
    handlers.handleCommentDeleteClick,
  );

  // Add event listener for credentials upload
  UI.auth.uploadCredentialsBtn?.addEventListener(
    'click',
    handlers.handleCredentialsUpload,
  );

  // Check authorization status
  api.checkAuth();
}

// Start app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
