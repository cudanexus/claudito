/**
 * Ralph Loop Module
 * Handles Ralph Loop UI rendering, controls, and real-time updates
 * Based on Geoffrey Huntley's "Ralph Wiggum technique" - iterative worker/reviewer pattern
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RalphLoopModule = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  // Dependencies injected via init()
  var state = null;
  var escapeHtml = null;
  var showToast = null;
  var api = null;

  // Module-local state
  var currentLoop = null;
  var outputBuffer = [];
  var isTabActive = false;

  function init(deps) {
    state = deps.state;
    escapeHtml = deps.escapeHtml;
    showToast = deps.showToast;
    api = deps.ApiClient;
    setupEventListeners();
  }

  // ============================================================
  // Rendering Functions
  // ============================================================

  function render() {
    var $container = $('#ralph-loop-panel');

    if (!$container.length) {
      return;
    }

    var html = renderConfigForm();
    html += renderControls();
    html += renderProgress();
    html += renderOutput();
    html += renderHistory();

    $container.html(html);
  }

  function renderConfigForm() {
    var disabled = currentLoop && isLoopActive(currentLoop.status) ? 'disabled' : '';

    return '<div class="ralph-loop-config p-3 bg-gray-800 rounded mb-3">' +
      '<h3 class="text-sm font-medium text-gray-200 mb-2">Start New Ralph Loop</h3>' +
      '<div class="space-y-2">' +
        '<div>' +
          '<label class="block text-xs text-gray-400 mb-1">Task Description</label>' +
          '<textarea id="ralph-task-description" class="w-full p-2 bg-gray-700 text-gray-200 rounded text-sm resize-none" ' +
            'rows="3" placeholder="Describe the task for the worker agent..." ' + disabled + '></textarea>' +
        '</div>' +
        '<div class="grid grid-cols-2 gap-2">' +
          '<div>' +
            '<label class="block text-xs text-gray-400 mb-1">Max Turns</label>' +
            '<input type="number" id="ralph-max-turns" class="w-full p-2 bg-gray-700 text-gray-200 rounded text-sm" ' +
              'value="5" min="1" max="20" ' + disabled + ' />' +
          '</div>' +
          '<div>' +
            '<label class="block text-xs text-gray-400 mb-1">Worker Model</label>' +
            '<select id="ralph-worker-model" class="w-full p-2 bg-gray-700 text-gray-200 rounded text-sm" ' + disabled + '>' +
              '<option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>' +
              '<option value="claude-opus-4-20250514">Claude Opus 4</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<label class="block text-xs text-gray-400 mb-1">Reviewer Model</label>' +
          '<select id="ralph-reviewer-model" class="w-full p-2 bg-gray-700 text-gray-200 rounded text-sm" ' + disabled + '>' +
            '<option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>' +
            '<option value="claude-opus-4-20250514">Claude Opus 4</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderControls() {
    var status = currentLoop ? currentLoop.status : 'idle';
    var canStart = !currentLoop || !isLoopActive(status);
    var canStop = currentLoop && isLoopRunning(status);
    var canPause = currentLoop && isLoopRunning(status);
    var canResume = currentLoop && status === 'paused';

    return '<div class="ralph-loop-controls flex gap-2 mb-3">' +
      '<button id="ralph-loop-start-btn" class="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-sm ' +
        (canStart ? '' : 'opacity-50 cursor-not-allowed') + '" ' + (canStart ? '' : 'disabled') + '>' +
        '<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
        '</svg>Start' +
      '</button>' +
      '<button id="ralph-loop-pause-btn" class="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-sm ' +
        (canPause ? '' : 'opacity-50 cursor-not-allowed hidden') + '" ' + (canPause ? '' : 'disabled') + '>' +
        '<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
        '</svg>Pause' +
      '</button>' +
      '<button id="ralph-loop-resume-btn" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm ' +
        (canResume ? '' : 'opacity-50 cursor-not-allowed hidden') + '" ' + (canResume ? '' : 'disabled') + '>' +
        '<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
        '</svg>Resume' +
      '</button>' +
      '<button id="ralph-loop-stop-btn" class="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-sm ' +
        (canStop ? '' : 'opacity-50 cursor-not-allowed hidden') + '" ' + (canStop ? '' : 'disabled') + '>' +
        '<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>' +
        '</svg>Stop' +
      '</button>' +
    '</div>';
  }

  function renderProgress() {
    if (!currentLoop) {
      return '<div id="ralph-loop-progress" class="hidden"></div>';
    }

    var iteration = currentLoop.currentIteration;
    var maxTurns = currentLoop.config.maxTurns;
    var status = currentLoop.status;
    var progress = maxTurns > 0 ? Math.round((iteration / maxTurns) * 100) : 0;
    var phaseText = getPhaseText(status);
    var statusColor = getStatusColor(status);

    return '<div id="ralph-loop-progress" class="p-3 bg-gray-800 rounded mb-3">' +
      '<div class="flex justify-between text-sm mb-1">' +
        '<span class="text-gray-300">Iteration ' + iteration + ' / ' + maxTurns + '</span>' +
        '<span class="' + statusColor + '">' + phaseText + '</span>' +
      '</div>' +
      '<div class="w-full bg-gray-700 rounded-full h-2">' +
        '<div class="bg-purple-500 h-2 rounded-full transition-all duration-300" style="width: ' + progress + '%"></div>' +
      '</div>' +
      (currentLoop.finalStatus ? renderFinalStatus(currentLoop.finalStatus) : '') +
    '</div>';
  }

  function renderFinalStatus(finalStatus) {
    var bgColor, text;

    switch (finalStatus) {
      case 'approved':
        bgColor = 'bg-green-900/50 text-green-300';
        text = 'Task approved by reviewer';
        break;
      case 'max_turns_reached':
        bgColor = 'bg-yellow-900/50 text-yellow-300';
        text = 'Maximum iterations reached';
        break;
      case 'critical_failure':
        bgColor = 'bg-red-900/50 text-red-300';
        text = 'Critical failure occurred';
        break;
      default:
        bgColor = 'bg-gray-700 text-gray-300';
        text = finalStatus;
    }

    return '<div class="mt-2 p-2 ' + bgColor + ' rounded text-sm">' + escapeHtml(text) + '</div>';
  }

  function renderOutput() {
    var hasOutput = outputBuffer.length > 0;

    return '<div class="ralph-loop-output mb-3">' +
      '<h3 class="text-sm font-medium text-gray-200 mb-2">Output</h3>' +
      '<div id="ralph-output-container" class="p-3 bg-gray-900 rounded font-mono text-xs h-48 overflow-y-auto">' +
        (hasOutput ? outputBuffer.map(function(line) {
          return '<div class="' + line.cssClass + '">' + escapeHtml(line.text) + '</div>';
        }).join('') : '<span class="text-gray-500">No output yet...</span>') +
      '</div>' +
    '</div>';
  }

  function renderHistory() {
    return '<div class="ralph-loop-history">' +
      '<h3 class="text-sm font-medium text-gray-200 mb-2">History</h3>' +
      '<div id="ralph-history-container" class="space-y-2 max-h-64 overflow-y-auto">' +
        '<span class="text-gray-500 text-sm">Loading...</span>' +
      '</div>' +
    '</div>';
  }

  function renderHistoryList(loops) {
    if (!loops || loops.length === 0) {
      return '<span class="text-gray-500 text-sm">No Ralph Loop history</span>';
    }

    return loops.map(function(loop) {
      var statusColor = getStatusColor(loop.status);
      var finalText = loop.finalStatus ? ' - ' + loop.finalStatus : '';
      var taskPreview = loop.config.taskDescription.substring(0, 50) +
        (loop.config.taskDescription.length > 50 ? '...' : '');

      return '<div class="p-2 bg-gray-800 rounded text-sm group">' +
        '<div class="flex justify-between items-start">' +
          '<div class="flex-1 min-w-0">' +
            '<div class="text-gray-300 truncate" title="' + escapeHtml(loop.config.taskDescription) + '">' +
              escapeHtml(taskPreview) +
            '</div>' +
            '<div class="text-xs text-gray-500">' +
              'Iterations: ' + loop.currentIteration + '/' + loop.config.maxTurns +
              ' | ' + formatDate(loop.createdAt) +
            '</div>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            '<span class="' + statusColor + ' text-xs">' + loop.status + finalText + '</span>' +
            '<button class="ralph-loop-delete-btn opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1 transition-opacity" ' +
              'data-task-id="' + escapeHtml(loop.taskId) + '" title="Delete">' +
              '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" ' +
                  'd="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>' +
              '</svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ============================================================
  // Helper Functions
  // ============================================================

  function isLoopActive(status) {
    return status === 'worker_running' || status === 'reviewer_running' || status === 'paused';
  }

  function isLoopRunning(status) {
    return status === 'worker_running' || status === 'reviewer_running';
  }

  function getPhaseText(status) {
    switch (status) {
      case 'idle': return 'Idle';
      case 'worker_running': return 'Worker Running';
      case 'reviewer_running': return 'Reviewer Running';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'paused': return 'Paused';
      default: return status;
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'worker_running': return 'text-blue-400';
      case 'reviewer_running': return 'text-purple-400';
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      case 'paused': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  }

  function formatDate(dateString) {
    var date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  function addOutput(text, cssClass) {
    outputBuffer.push({ text: text, cssClass: cssClass || 'text-gray-300' });

    // Limit buffer size
    if (outputBuffer.length > 500) {
      outputBuffer = outputBuffer.slice(-400);
    }

    // Update output container if visible
    var $container = $('#ralph-output-container');

    if ($container.length) {
      $container.append('<div class="' + (cssClass || 'text-gray-300') + '">' + escapeHtml(text) + '</div>');
      $container.scrollTop($container[0].scrollHeight);
    }
  }

  function clearOutput() {
    outputBuffer = [];
    var $container = $('#ralph-output-container');

    if ($container.length) {
      $container.html('<span class="text-gray-500">No output yet...</span>');
    }
  }

  // ============================================================
  // API Actions
  // ============================================================

  function startLoop() {
    if (!state.selectedProjectId) {
      showToast('No project selected', 'error');
      return;
    }

    var taskDescription = $('#ralph-task-description').val();

    if (!taskDescription || !taskDescription.trim()) {
      showToast('Please enter a task description', 'warning');
      return;
    }

    var config = {
      taskDescription: taskDescription.trim(),
      maxTurns: parseInt($('#ralph-max-turns').val(), 10) || 5,
      workerModel: $('#ralph-worker-model').val(),
      reviewerModel: $('#ralph-reviewer-model').val()
    };

    api.startRalphLoop(state.selectedProjectId, config)
      .done(function(loopState) {
        currentLoop = loopState;
        clearOutput();
        addOutput('Ralph Loop started: ' + config.taskDescription, 'text-green-400');
        render();
        showToast('Ralph Loop started', 'success');
      })
      .fail(function(xhr) {
        var message = xhr.responseJSON ? xhr.responseJSON.error : 'Failed to start Ralph Loop';
        showToast(message, 'error');
      });
  }

  function stopLoop() {
    if (!state.selectedProjectId || !currentLoop) {
      return;
    }

    api.stopRalphLoop(state.selectedProjectId, currentLoop.taskId)
      .done(function() {
        addOutput('Ralph Loop stopped', 'text-yellow-400');
        currentLoop.status = 'idle';
        render();
        showToast('Ralph Loop stopped', 'info');
      })
      .fail(function(xhr) {
        var message = xhr.responseJSON ? xhr.responseJSON.error : 'Failed to stop Ralph Loop';
        showToast(message, 'error');
      });
  }

  function pauseLoop() {
    if (!state.selectedProjectId || !currentLoop) {
      return;
    }

    api.pauseRalphLoop(state.selectedProjectId, currentLoop.taskId)
      .done(function() {
        addOutput('Ralph Loop paused', 'text-yellow-400');
        currentLoop.status = 'paused';
        render();
        showToast('Ralph Loop paused', 'info');
      })
      .fail(function(xhr) {
        var message = xhr.responseJSON ? xhr.responseJSON.error : 'Failed to pause Ralph Loop';
        showToast(message, 'error');
      });
  }

  function resumeLoop() {
    if (!state.selectedProjectId || !currentLoop) {
      return;
    }

    api.resumeRalphLoop(state.selectedProjectId, currentLoop.taskId)
      .done(function() {
        addOutput('Ralph Loop resumed', 'text-green-400');
        currentLoop.status = 'worker_running';
        render();
        showToast('Ralph Loop resumed', 'success');
      })
      .fail(function(xhr) {
        var message = xhr.responseJSON ? xhr.responseJSON.error : 'Failed to resume Ralph Loop';
        showToast(message, 'error');
      });
  }

  function loadHistory() {
    if (!state.selectedProjectId) {
      return;
    }

    api.getRalphLoops(state.selectedProjectId)
      .done(function(loops) {
        var $container = $('#ralph-history-container');

        if ($container.length) {
          $container.html(renderHistoryList(loops));
        }

        // Update currentLoop if there's an active one
        var activeLoop = loops.find(function(loop) {
          return isLoopActive(loop.status);
        });

        if (activeLoop && (!currentLoop || currentLoop.taskId !== activeLoop.taskId)) {
          currentLoop = activeLoop;
          render();
        }
      })
      .fail(function() {
        var $container = $('#ralph-history-container');

        if ($container.length) {
          $container.html('<span class="text-red-400 text-sm">Failed to load history</span>');
        }
      });
  }

  function deleteLoop(taskId) {
    if (!state.selectedProjectId || !taskId) {
      return;
    }

    if (!confirm('Are you sure you want to delete this Ralph Loop?')) {
      return;
    }

    api.deleteRalphLoop(state.selectedProjectId, taskId)
      .done(function() {
        if (currentLoop && currentLoop.taskId === taskId) {
          currentLoop = null;
          clearOutput();
          render();
        }
        loadHistory();
        showToast('Ralph Loop deleted', 'info');
      })
      .fail(function(xhr) {
        var message = xhr.responseJSON ? xhr.responseJSON.error : 'Failed to delete Ralph Loop';
        showToast(message, 'error');
      });
  }

  // ============================================================
  // WebSocket Handlers
  // ============================================================

  function handleWebSocketMessage(type, data) {
    // Ignore messages for other projects
    if (data.projectId && data.projectId !== state.selectedProjectId) {
      return;
    }

    switch (type) {
      case 'ralph_loop_status':
        handleStatusChange(data);
        break;
      case 'ralph_loop_iteration':
        handleIterationStart(data);
        break;
      case 'ralph_loop_output':
        handleOutput(data);
        break;
      case 'ralph_loop_complete':
        handleLoopComplete(data);
        break;
      case 'ralph_loop_worker_complete':
        handleWorkerComplete(data);
        break;
      case 'ralph_loop_reviewer_complete':
        handleReviewerComplete(data);
        break;
      case 'ralph_loop_error':
        handleLoopError(data);
        break;
    }
  }

  function handleStatusChange(data) {
    if (currentLoop && currentLoop.taskId === data.taskId) {
      currentLoop.status = data.status;
      updateControlsUI();
      updateProgressUI();
    }
  }

  function handleIterationStart(data) {
    if (currentLoop && currentLoop.taskId === data.taskId) {
      currentLoop.currentIteration = data.iteration;
      addOutput('--- Iteration ' + data.iteration + ' started ---', 'text-purple-400');
      updateProgressUI();
    }
  }

  function handleOutput(data) {
    if (currentLoop && currentLoop.taskId === data.taskId) {
      var cssClass = data.source === 'worker' ? 'text-blue-300' : 'text-purple-300';
      addOutput('[' + data.source + '] ' + data.content, cssClass);
    }
  }

  function handleWorkerComplete(data) {
    if (currentLoop && currentLoop.taskId === data.taskId) {
      addOutput('Worker completed iteration ' + data.summary.iterationNumber, 'text-green-400');

      if (data.summary.filesModified && data.summary.filesModified.length > 0) {
        addOutput('Files modified: ' + data.summary.filesModified.join(', '), 'text-gray-400');
      }
    }
  }

  function handleReviewerComplete(data) {
    if (currentLoop && currentLoop.taskId === data.taskId) {
      var decisionColor = data.feedback.decision === 'approve' ? 'text-green-400' :
        data.feedback.decision === 'reject' ? 'text-red-400' : 'text-yellow-400';
      addOutput('Reviewer decision: ' + data.feedback.decision, decisionColor);

      if (data.feedback.feedback) {
        addOutput('Feedback: ' + data.feedback.feedback, 'text-gray-400');
      }
    }
  }

  function handleLoopComplete(data) {
    if (currentLoop && currentLoop.taskId === data.taskId) {
      currentLoop.status = 'completed';
      currentLoop.finalStatus = data.finalStatus;
      addOutput('=== Ralph Loop completed: ' + data.finalStatus + ' ===', 'text-green-400');
      render();
      loadHistory();
    }
  }

  function handleLoopError(data) {
    if (currentLoop && currentLoop.taskId === data.taskId) {
      currentLoop.status = 'failed';
      currentLoop.error = data.error;
      addOutput('Error: ' + data.error, 'text-red-400');
      render();
    }
  }

  // ============================================================
  // UI Update Helpers
  // ============================================================

  function updateControlsUI() {
    var status = currentLoop ? currentLoop.status : 'idle';
    var $startBtn = $('#ralph-loop-start-btn');
    var $pauseBtn = $('#ralph-loop-pause-btn');
    var $resumeBtn = $('#ralph-loop-resume-btn');
    var $stopBtn = $('#ralph-loop-stop-btn');

    var canStart = !currentLoop || !isLoopActive(status);
    var canStop = currentLoop && isLoopRunning(status);
    var canPause = currentLoop && isLoopRunning(status);
    var canResume = currentLoop && status === 'paused';

    $startBtn.prop('disabled', !canStart).toggleClass('opacity-50 cursor-not-allowed', !canStart);
    $pauseBtn.prop('disabled', !canPause).toggleClass('hidden', !canPause);
    $resumeBtn.prop('disabled', !canResume).toggleClass('hidden', !canResume);
    $stopBtn.prop('disabled', !canStop).toggleClass('hidden', !canStop);
  }

  function updateProgressUI() {
    if (!currentLoop) {
      $('#ralph-loop-progress').addClass('hidden');
      return;
    }

    var $progress = $('#ralph-loop-progress');

    if (!$progress.length) {
      return;
    }

    $progress.removeClass('hidden');
    var iteration = currentLoop.currentIteration;
    var maxTurns = currentLoop.config.maxTurns;
    var progress = maxTurns > 0 ? Math.round((iteration / maxTurns) * 100) : 0;
    var phaseText = getPhaseText(currentLoop.status);
    var statusColor = getStatusColor(currentLoop.status);

    $progress.find('.text-gray-300').first().text('Iteration ' + iteration + ' / ' + maxTurns);
    $progress.find('span').last().removeClass().addClass(statusColor).text(phaseText);
    $progress.find('.bg-purple-500').css('width', progress + '%');
  }

  // ============================================================
  // Event Listeners
  // ============================================================

  function setupEventListeners() {
    $(document).on('click', '#ralph-loop-start-btn', function() {
      startLoop();
    });

    $(document).on('click', '#ralph-loop-stop-btn', function() {
      stopLoop();
    });

    $(document).on('click', '#ralph-loop-pause-btn', function() {
      pauseLoop();
    });

    $(document).on('click', '#ralph-loop-resume-btn', function() {
      resumeLoop();
    });

    $(document).on('click', '.ralph-loop-delete-btn', function() {
      var taskId = $(this).data('task-id');
      deleteLoop(taskId);
    });

    $(document).on('click', '#tab-ralph-loop', function() {
      onTabActivated();
    });
  }

  function onTabActivated() {
    isTabActive = true;
    render();
    loadHistory();
  }

  function onProjectChanged() {
    currentLoop = null;
    clearOutput();

    if (isTabActive) {
      render();
      loadHistory();
    }
  }

  // ============================================================
  // Public API
  // ============================================================

  return {
    init: init,
    render: render,
    handleWebSocketMessage: handleWebSocketMessage,
    loadHistory: loadHistory,
    onTabActivated: onTabActivated,
    onProjectChanged: onProjectChanged,
    clearOutput: clearOutput,
    // Expose for testing
    _getState: function() {
      return {
        currentLoop: currentLoop,
        outputBuffer: outputBuffer,
        isTabActive: isTabActive
      };
    },
    _setCurrentLoop: function(loop) {
      currentLoop = loop;
    }
  };
}));
