/* eslint-disable no-return-await */
/* eslint-disable no-plusplus */
/* eslint-disable no-promise-executor-return */
/* eslint-disable node/no-unsupported-features/es-syntax */
/* eslint-disable camelcase */
/* eslint-disable node/no-unsupported-features/node-builtins */
/* eslint-disable no-loop-func */
/* eslint-disable no-await-in-loop */
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  shell,
  dialog,
  session,
} = require('electron');
const path = require('path');
const fsSync = require('fs');
const fs = require('fs').promises;
const { google } = require('googleapis');
// const { promisify } = require('util');

// Configuration constants
const CONFIG = {
  SCOPES: ['https://www.googleapis.com/auth/youtube.force-ssl'],
  TOKEN_PATH: path.join(app.getPath('userData'), 'token.json'),
  BLOCKED_WORDS_PATH: path.join(__dirname, 'blockedword.json'),
  API_DELAY: 300, // ms between API requests
  BATCH_SIZE: 50, // Comments to process in one batch
  CONCURRENT_REQUESTS: 3, // Balance between speed and rate limits
  DEV_MODE: process.env.NODE_ENV === 'development',
};

// Global state
let mainWindow;
let globalOAuth2Client = null;
let blockedWords = [];
let youtubeChannelID = null;
let isProcessing = false;

/**
 * Create a YouTube client with authentication
 * @param {Object} auth - OAuth2 client
 * @returns {Object} YouTube client
 */
function createYoutubeClient(auth) {
  return google.youtube({ version: 'v3', auth });
}

/**
 * Load blocked words from file
 * @returns {Promise<Array>} Array of blocked words
 */
async function loadBlockedWords() {
  try {
    const data = await fs.readFile(CONFIG.BLOCKED_WORDS_PATH, 'utf8');
    blockedWords = JSON.parse(data);
    console.log(`Loaded ${blockedWords.length} blocked words`);
    return blockedWords;
  } catch (error) {
    console.error('Error loading blocked words:', error.message);
    return [];
  }
}

/**
 * Check if user is authorized
 * @returns {Promise<Object>} Authorization status
 */
async function checkAuthorization() {
  try {
    // Check if token exists and is valid
    if (fsSync.existsSync(CONFIG.TOKEN_PATH) && globalOAuth2Client) {
      // Check if token is still valid
      if (!globalOAuth2Client.isTokenExpiring()) {
        return { authenticated: true };
      }

      // Try to refresh token
      try {
        await globalOAuth2Client.getAccessToken();
        return { authenticated: true };
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError.message);
        return {
          authenticated: false,
          error: 'Token expired and refresh failed',
        };
      }
    }
    return { authenticated: false };
  } catch (error) {
    console.error('Error checking authorization status:', error);
    return { authenticated: false, error: error.message };
  }
}

/**
 * Get or create OAuth2 client
 * @returns {Promise<Object>} OAuth2 client
 */
async function getOAuth2Client() {
  try {
    // First check for credentials in user data directory (uploaded by user)
    const userCredentialsPath = path.join(
      app.getPath('userData'),
      'credentials.json',
    );
    let credentialsBuffer;

    // Try loading user-uploaded credentials first
    if (fsSync.existsSync(userCredentialsPath)) {
      credentialsBuffer = await fs.readFile(userCredentialsPath, 'utf8');
    } else {
      // Fall back to bundled credentials if available
      const bundledCredentialsPath = path.join(__dirname, 'credentials.json');

      if (!fsSync.existsSync(bundledCredentialsPath)) {
        throw new Error(
          'No credentials file found. Please upload your Google API credentials.',
        );
      }

      credentialsBuffer = await fs.readFile(bundledCredentialsPath, 'utf8');
    }

    const credentials = JSON.parse(credentialsBuffer);
    const { client_secret, client_id, redirect_uris } = credentials.installed;

    return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  } catch (error) {
    console.error('Error creating OAuth2 client:', error.message);
    throw new Error(`Failed to create authentication client: ${error.message}`);
  }
}

/**
 * Authorize with YouTube
 * @returns {Promise<Object>} Authorization result
 */
async function authorize() {
  try {
    const oAuth2Client = await getOAuth2Client();

    // Check if token exists
    if (fsSync.existsSync(CONFIG.TOKEN_PATH)) {
      try {
        const tokenBuffer = await fs.readFile(CONFIG.TOKEN_PATH, 'utf8');
        const token = JSON.parse(tokenBuffer);
        oAuth2Client.setCredentials(token);

        // Check if token is expired
        if (oAuth2Client.isTokenExpiring()) {
          console.log('Token is expired, refreshing...');
          try {
            const newToken = await oAuth2Client.getAccessToken();
            oAuth2Client.setCredentials(newToken.res.data);
            await fs.writeFile(
              CONFIG.TOKEN_PATH,
              JSON.stringify(newToken.res.data),
            );
            console.log('Token refreshed and stored');
          } catch (refreshError) {
            console.error('Error refreshing token:', refreshError.message);
            return await getNewToken(oAuth2Client);
          }
        }

        globalOAuth2Client = oAuth2Client;
        return { authenticated: true };
      } catch (error) {
        console.error('Error reading token:', error.message);
        return await getNewToken(oAuth2Client);
      }
    } else {
      return await getNewToken(oAuth2Client);
    }
  } catch (error) {
    console.error('Authorization error:', error.message);
    return { authenticated: false, error: error.message };
  }
}

/**
 * Get new auth token
 * @param {Object} oAuth2Client - OAuth2 client
 * @returns {Promise<Object>} Authorization result
 */
async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: CONFIG.SCOPES,
  });

  const authWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  return new Promise((resolve) => {
    authWindow.loadURL(authUrl);

    authWindow.webContents.on('will-redirect', async (event, url) => {
      const queryParams = new URL(url).searchParams;
      const code = queryParams.get('code');

      if (!code) return;

      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // Set up token refresh handler
        oAuth2Client.on('tokens', async (newTokens) => {
          try {
            const updatedTokens = { ...tokens, ...newTokens };
            await fs.writeFile(
              CONFIG.TOKEN_PATH,
              JSON.stringify(updatedTokens),
            );
            console.log('Token refreshed and stored');
          } catch (error) {
            console.error('Failed to save refreshed token:', error.message);
          }
        });

        await fs.writeFile(CONFIG.TOKEN_PATH, JSON.stringify(tokens));
        console.log('Token stored to', CONFIG.TOKEN_PATH);

        globalOAuth2Client = oAuth2Client;
        authWindow.close();
        resolve({ authenticated: true });
      } catch (error) {
        console.error('Error retrieving token:', error.message);
        authWindow.close();
        resolve({ authenticated: false, error: error.message });
      }
    });

    authWindow.on('closed', () => {
      resolve({ authenticated: false });
    });
  });
}

/**
 * Check if comment is spam
 * @param {string} text - Comment text
 * @returns {boolean} Is spam
 */
function isSpamComment(text) {
  if (!text) return false;

  // Check for unicode manipulation (common spam technique)
  const normalizedText = text.normalize('NFKD');
  if (text !== normalizedText) {
    return true;
  }

  const lowerText = text.toLowerCase();
  return blockedWords.some((word) => lowerText.includes(word.toLowerCase()));
}

/**
 * Fetch comments for a video
 * @param {Object} auth - OAuth2 client
 * @param {string} videoId - Video ID
 * @returns {Promise<Object>} Comments and spam comments
 */
async function fetchComments(auth, videoId) {
  const youtube = createYoutubeClient(auth);
  const spamComments = {};
  const allComments = [];

  try {
    console.log(`Fetching comments for video: ${videoId}`);

    // We'll use pagination to get all comments
    let nextPageToken = null;
    let totalProcessed = 0;

    do {
      const params = {
        part: 'snippet',
        videoId: videoId,
        maxResults: 100,
        pageToken: nextPageToken || undefined,
      };

      const response = await youtube.commentThreads.list(params);

      if (!response.data.items || response.data.items.length === 0) {
        console.log(`No more comments found for video ${videoId}`);
        break;
      }

      response.data.items.forEach((item) => {
        try {
          const comment = item.snippet.topLevelComment.snippet;
          const commentText = comment.textDisplay || '';
          const commentId = item.id;
          const authorName = comment.authorDisplayName || 'Unknown';

          allComments.push(commentText);

          if (isSpamComment(commentText)) {
            console.log(
              `🚨 Spam detected from ${authorName}: "${commentText.substring(0, 50)}..."`,
            );
            spamComments[commentId] = {
              text: commentText,
              author: authorName,
              publishedAt: comment.publishedAt,
            };
          }
        } catch (itemError) {
          console.error(`Error processing comment item:`, itemError.message);
        }
      });

      totalProcessed += response.data.items.length;
      nextPageToken = response.data.nextPageToken;

      // Add a small delay to avoid hitting API limits
      if (nextPageToken) {
        await new Promise((resolve) => setTimeout(resolve, CONFIG.API_DELAY));
      }
    } while (nextPageToken);

    console.log(
      `Processed ${totalProcessed} comments for video ${videoId}, found ${Object.keys(spamComments).length} spam comments`,
    );
    return { allComments, spamComments };
  } catch (error) {
    console.error(`Error fetching comments for ${videoId}:`, error.message);
    return { allComments, spamComments, error: error.message };
  }
}

/**
 * Process videos in batches
 * @param {Object} auth - OAuth2 client
 * @param {Array} videoIds - Video IDs
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<Object>} All comments and spam comments
 */
async function processVideos(auth, videoIds, progressCallback = null) {
  const allComments = [];
  const spamComments = {};
  const failedVideos = [];

  const totalVideos = videoIds.length;
  let processedVideos = 0;

  // Process videos in batches to control concurrency
  for (let i = 0; i < videoIds.length; i += CONFIG.CONCURRENT_REQUESTS) {
    const batch = videoIds.slice(i, i + CONFIG.CONCURRENT_REQUESTS);

    try {
      const results = await Promise.all(
        batch.map(async (videoId) => {
          try {
            return await fetchComments(auth, videoId);
          } catch (error) {
            failedVideos.push(videoId);
            console.error(`Error processing video ${videoId}:`, error.message);
            return { allComments: [], spamComments: {} };
          } finally {
            processedVideos++;
            if (progressCallback) {
              progressCallback(processedVideos, totalVideos);
            }
          }
        }),
      );

      // Consolidate results
      results.forEach((result) => {
        if (result.allComments) {
          allComments.push(...result.allComments);
        }
        if (result.spamComments) {
          Object.assign(spamComments, result.spamComments);
        }
      });

      if (i + CONFIG.CONCURRENT_REQUESTS < videoIds.length) {
        await new Promise((resolve) => setTimeout(resolve, CONFIG.API_DELAY));
      }
    } catch (batchError) {
      console.error('Batch processing error:', batchError.message);
      // Continue with next batch
    }
  }

  return {
    allComments,
    spamComments,
    failedVideos,
    stats: {
      totalVideos,
      processedVideos,
      failedVideos: failedVideos.length,
      totalComments: allComments.length,
      totalSpamComments: Object.keys(spamComments).length,
    },
  };
}

/**
 * Delete comments
 * @param {Object} auth - OAuth2 client
 * @param {Array} commentIds - Comment IDs
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<Object>} Delete result
 */
async function deleteComments(auth, commentIds, progressCallback = null) {
  if (!commentIds || commentIds.length === 0) {
    return { success: true, totalDeleted: 0, totalRequested: 0 };
  }

  const youtube = createYoutubeClient(auth);
  const totalCommentsToBeDeleted = commentIds.length;
  let totalDeletedComments = 0;
  const failedCommentIds = [];

  try {
    // Create chunks of commentIds
    const chunks = [];
    for (let i = 0; i < commentIds.length; i += CONFIG.BATCH_SIZE) {
      chunks.push(commentIds.slice(i, i + CONFIG.BATCH_SIZE));
    }

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      try {
        await youtube.comments.setModerationStatus({
          id: chunk,
          moderationStatus: 'rejected',
        });

        totalDeletedComments += chunk.length;
        console.log(
          `Progress: ${totalDeletedComments}/${totalCommentsToBeDeleted} deleted`,
        );

        if (progressCallback) {
          progressCallback(totalDeletedComments, totalCommentsToBeDeleted);
        }
      } catch (chunkError) {
        console.error('Error deleting comment chunk:', chunkError.message);
        failedCommentIds.push(...chunk);
      }

      // Add delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, CONFIG.API_DELAY));
      }
    }

    return {
      success: true,
      totalDeleted: totalDeletedComments,
      totalRequested: totalCommentsToBeDeleted,
      failedIds: failedCommentIds,
    };
  } catch (error) {
    console.error('Failed to delete comments:', error.message);
    return {
      success: false,
      error: error.message,
      totalDeleted: totalDeletedComments,
      totalRequested: totalCommentsToBeDeleted,
      failedIds: failedCommentIds,
    };
  }
}

/**
 * Fetch all videos from a channel
 * @param {Object} auth - OAuth2 client
 * @returns {Promise<Array>} Video IDs
 */
async function fetchAllVideos(auth) {
  if (!youtubeChannelID) {
    throw new Error(
      'No YouTube channel ID provided. Please enter a channel ID first.',
    );
  }

  const youtube = createYoutubeClient(auth);

  try {
    console.log('Fetching channel details for ID:', youtubeChannelID);
    const response = await youtube.channels.list({
      part: 'contentDetails',
      id: youtubeChannelID,
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Channel not found. Please check the ID and try again.');
    }

    const channel = response.data.items[0];
    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

    // Get all videos from the uploads playlist
    const allVideos = [];
    let nextPageToken = '';

    console.log('Fetching videos from channel uploads playlist...');

    do {
      const playlistResponse = await youtube.playlistItems.list({
        part: 'snippet',
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: nextPageToken,
      });

      const { items } = playlistResponse.data;
      if (items && items.length > 0) {
        items.forEach((item) => {
          if (
            item.snippet &&
            item.snippet.resourceId &&
            item.snippet.resourceId.videoId
          ) {
            allVideos.push(item.snippet.resourceId.videoId);
          }
        });
      }

      nextPageToken = playlistResponse.data.nextPageToken;

      if (nextPageToken) {
        await new Promise((resolve) => setTimeout(resolve, CONFIG.API_DELAY));
      }
    } while (nextPageToken);

    console.log(`Found ${allVideos.length} videos in the channel`);
    return allVideos;
  } catch (error) {
    console.error('Error fetching videos:', error);
    throw error;
  }
}

/**
 * Main function to get YouTube content
 * @param {Object} auth - OAuth2 client
 * @returns {Promise<Object>} All comments and spam comments
 */
async function youtubeContentList(auth) {
  if (isProcessing) {
    return {
      status: 'error',
      error: 'Another process is already running. Please wait.',
    };
  }

  isProcessing = true;

  try {
    if (!youtubeChannelID) {
      throw new Error(
        'No YouTube channel ID provided. Please enter a channel ID first.',
      );
    }

    // Fetch all video IDs
    const allVideos = await fetchAllVideos(auth);

    if (allVideos.length === 0) {
      return {
        allComments: [],
        spamComments: {},
        status: 'success',
        message: 'No videos found in this channel.',
      };
    }

    // Process videos
    console.log(`Processing ${allVideos.length} videos...`);
    const result = await processVideos(auth, allVideos);

    return {
      allComments: result.allComments,
      spamComments: result.spamComments,
      status: 'success',
      stats: result.stats,
    };
  } catch (error) {
    console.error('Error fetching YouTube content:', error);
    return {
      allComments: [],
      spamComments: {},
      status: 'error',
      error: error.message,
    };
  } finally {
    isProcessing = false;
  }
}

/**
 * Setup IPC handlers
 */
function setupIpcHandlers() {
  // Check authorization
  ipcMain.handle('check-authorization', async () => await checkAuthorization());

  // Authorization
  ipcMain.handle('authorize', async () => await authorize());

  // Set channel ID
  ipcMain.handle('set-channel-id', async (event, channelId) => {
    if (
      !channelId ||
      typeof channelId !== 'string' ||
      channelId.trim() === ''
    ) {
      return {
        success: false,
        error: 'Invalid channel ID',
      };
    }

    youtubeChannelID = channelId.trim();
    console.log('Channel ID set to:', youtubeChannelID);
    return {
      success: true,
    };
  });

  // Get content
  ipcMain.handle('youtube-content-list', async () => {
    if (!globalOAuth2Client) {
      return {
        allComments: [],
        spamComments: {},
        status: 'error',
        error: 'Not authenticated',
      };
    }

    return await youtubeContentList(globalOAuth2Client);
  });

  // Delete comments
  ipcMain.handle('delete-comments', async (event, commentIds) => {
    if (!globalOAuth2Client) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    return await deleteComments(globalOAuth2Client, commentIds);
  });

  // Upload credentials
  ipcMain.handle('upload-credentials', async (event, credentialsData) => {
    try {
      console.log('==== CREDENTIALS UPLOAD STARTED ====');
      console.log(
        'Received credential data:',
        `${JSON.stringify(credentialsData, null, 2).substring(0, 500)}...`,
      );

      // Validate credentials data structure
      if (!credentialsData) {
        console.error('ERROR: Credentials data is null or undefined');
        return { success: false, error: 'No credentials data received' };
      }

      // Check if it has the installed property
      if (!credentialsData.installed) {
        console.error(
          'ERROR: Missing required "installed" property in credentials',
        );
        console.log('Keys found:', Object.keys(credentialsData));
        return {
          success: false,
          error: 'Invalid credentials data format: missing installed property',
        };
      }

      // Check for required fields
      const { client_id, client_secret, redirect_uris } =
        credentialsData.installed;
      if (!client_id || !client_secret || !redirect_uris) {
        console.error('ERROR: Missing required OAuth fields in credentials');
        console.log('Fields found:', Object.keys(credentialsData.installed));
        return {
          success: false,
          error: 'Invalid credentials: missing required OAuth fields',
        };
      }

      // Write credentials to file
      const credentialsPath = path.join(
        app.getPath('userData'),
        'credentials.json',
      );
      console.log('Saving credentials to:', credentialsPath);

      try {
        await fs.writeFile(
          credentialsPath,
          JSON.stringify(credentialsData, null, 2),
        );
        console.log('SUCCESS: Credentials file written successfully');
      } catch (writeError) {
        console.error('ERROR writing file:', writeError);
        return {
          success: false,
          error: `Failed to write credentials file: ${writeError.message}`,
        };
      }

      // Reset OAuth client
      console.log('Resetting OAuth client for new credentials');
      globalOAuth2Client = null;

      console.log('==== CREDENTIALS UPLOAD COMPLETED SUCCESSFULLY ====');
      return { success: true };
    } catch (error) {
      console.error('==== CREDENTIALS UPLOAD FAILED ====');
      console.error('Error details:', error);
      return {
        success: false,
        error: `Failed to save credentials: ${error.message}`,
      };
    }
  });
}

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // File Menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: isMac ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },

    // View Menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: (_, focusedWindow) => focusedWindow?.reload(),
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: (_, focusedWindow) =>
            focusedWindow?.webContents.reloadIgnoringCache(),
        },
        { type: 'separator' },
        {
          label: 'Toggle Full Screen',
          accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11',
          click: (_, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
            }
          },
        },
      ],
    },

    // Window Menu (use default)
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' },
            ]
          : [{ role: 'close' }]),
      ],
    },

    // Help Menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => showAboutDialog(),
        },
        {
          label: 'How To',
          click: () => showHowToDialog(),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// About dialog
function showAboutDialog() {
  dialog.showMessageBox(mainWindow, {
    title: 'About Zeus Killer',
    message: 'Zeus Killer',
    detail:
      'Version 1.0.0\n\nA tool to eliminate spam comments on YouTube videos.\n\n© 2025 Zeus Killer',
    buttons: ['OK'],
    icon: path.join(__dirname, 'assets/zeus-icon.png'), // Add an icon file if you have one
  });
}

// How To dialog
function showHowToDialog() {
  dialog.showMessageBox(mainWindow, {
    title: 'How To Use Zeus Killer',
    message: 'How to use Zeus Killer:',
    detail:
      '1. Authorize with your YouTube account\n2. Enter your YouTube Channel ID\n3. Click "Scan Comments" to find spam\n4. Use "Banish All Zeus Spam" to remove spam comments\n\nIndividual spam comments can also be deleted by clicking their trash icon.',
    buttons: ['OK'],
  });
}

/**
 * Create main window
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 740,
    icon: path.join(
      __dirname,
      process.platform === 'win32'
        ? 'assets/icon.ico'
        : process.platform === 'darwin'
          ? 'assets/icon.icns'
          : 'assets/icon.png',
    ),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });

  createApplicationMenu();

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (CONFIG.DEV_MODE) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App initialization
app.whenReady().then(async () => {
  try {
    // Initialize blocked words
    await loadBlockedWords();

    // Setup IPC
    setupIpcHandlers();

    // Create window
    createMainWindow();
  } catch (error) {
    console.error('Application initialization error:', error);
  }
});

// App lifecycle
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
