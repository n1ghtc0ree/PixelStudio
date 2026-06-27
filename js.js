$(document).ready(function () {
  console.log('jQuery loaded');

  const tooltip = $('<div>').addClass('custom-tooltip').appendTo('body');

  function showTooltip(element, text) {
    tooltip.text(text).addClass('visible');
    
    const rect = element.getBoundingClientRect();
    const tooltipWidth = tooltip.outerWidth();
    
    const left = rect.left + (rect.width - tooltipWidth) / 2;
    const top = rect.bottom + 8;
    
    tooltip.css({
      left: Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8)) + 'px',
      top: top + 'px'
    });
  }

  function hideTooltip() {
    tooltip.removeClass('visible');
  }

  $('body').on('mouseenter', '[title]', function() {
    const $el = $(this);
    const title = $el.attr('title');
    if (title) {
      $el.attr('data-tooltip', title);
      $el.removeAttr('title');
      showTooltip(this, title);
    }
  });

  $('body').on('mouseleave', '[data-tooltip]', function() {
    const $el = $(this);
    hideTooltip();
    $el.attr('title', $el.attr('data-tooltip'));
    $el.removeAttr('data-tooltip');
  });

  const editor = {
    canvas: $('#pixelCanvas')[0],
    ctx: null,
    width: 32,
    height: 32,
    pixelSize: 16,
    currentColor: '#ffffff',
    currentTool: 'pencil',
    showGrid: true,
    isDrawing: false,
    history: [],
    historyIndex: -1,
    maxHistory: 50,
    layers: [],
    currentLayer: 0,
    layerCount: 0,
    
    defaultPalette: [
      '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00',
      '#ff00ff', '#00ffff', '#ff8800', '#8800ff', '#00ff88', '#ff0088',
      '#88ff00', '#0088ff', '#ff8888', '#88ff88', '#8888ff', '#ffff88',
      '#ff88ff', '#88ffff', '#888888', '#444444', '#cccccc', '#660000',
      '#006600', '#000066', '#666600', '#660066', '#006666', '#333333'
    ],
    
    init: function () {
      this.ctx = this.canvas.getContext('2d');

      this.buildPalette();
      this.setupMobileDOM();
      this.bindEvents();
      this.updateUI();

      const hasSave = this.loadFromLocalStorage();
      if (!hasSave) {
        this.initLayers();
        setTimeout(() => {
          this.calculateAutoPixelSize();
          this.resizeCanvas();
          this.saveState();
        }, 50);
      }
      
      $(window).on('resize', () => {
        this.calculateAutoPixelSize();
        this.resizeCanvas();
      });

      this.bindImportEvents();
    },

    setupMobileDOM: function () {
      const container = $('.mobile-actions-wrapper').empty();
      $('.top-actions.main-actions').children().each(function() {
        if ($(this).hasClass('mobile-hide') && !$(this).hasClass('divider')) {
          const cloned = $(this).clone(true);
          cloned.removeClass('mobile-hide');
          if ($(this).attr('id') === 'toggleGridBtn') {
            cloned.toggleClass('active', this.showGrid !== false)
          }
          container.append(cloned);
        }
      });
    },

    calculateAutoPixelSize: function () {
      const wrapper = $('.canvas-wrapper');
      let maxW = wrapper.width();
      let maxH = wrapper.height();

      if (!maxW || maxW <= 0) maxW = window.innerWidth - 32;
      if (!maxH || maxH <= 0) maxH = window.innerHeight - 150;

      maxW = maxW - 32;
      maxH = maxH - 32;

      const sizeW = Math.floor(maxW / this.width);
      const sizeH = Math.floor(maxH / this.height);

      this.pixelSize = Math.max(2, Math.min(64, Math.min(sizeW, sizeH)));
    },

    resizeCanvas: function () {
      const displayWidth = this.width * this.pixelSize;
      const displayHeight = this.height * this.pixelSize;

      $(this.canvas).attr('width', displayWidth);
      $(this.canvas).attr('height', displayHeight);

      this.ctx.imageSmoothingEnabled = false;
      this.ctx.webkitImageSmoothingEnabled = false;
      this.ctx.mozImageSmoothingEnabled = false;

      this.render();
      $('#canvasSizeDisplay').text(`${this.width} x ${this.height}`);
    },

    initLayers: function () {
      this.layers = [];
      this.layerCount = 0;
      this.addLayer('Background');
    },

    addLayer: function (name) {
      let layerName = name;
      
      if (!layerName) {
        let maxNumber = 1;
        
        this.layers.forEach(l => {
          const match = l.name.match(/Layer\s+(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        });
        
        layerName = `Layer ${maxNumber + 1}`;
      }

      const buffer = document.createElement('canvas');
      buffer.width = this.width;
      buffer.height = this.height;
      const bCtx = buffer.getContext('2d');

      const newLayer = {
        id: Date.now() + Math.random(),
        name: layerName,
        visible: true,
        buffer: buffer,
        ctx: bCtx,
        isNew: true
      };

      this.layers.splice(this.currentLayer, 0, newLayer);
      this.renderLayersList();
      this.render();
    },

    deleteLayer: function (id) {
      if (this.layers.length <= 1) return;
      
      const self = this;
      const index = this.layers.findIndex(l => l.id === id);
      if (index === -1) return;

      const layerElement = $(`.layer-item[data-id="${id}"]`);

      layerElement.addClass('removing');
      
      setTimeout(function() {
        self.layers.splice(index, 1);
        if (self.currentLayer >= self.layers.length) {
          self.currentLayer = self.layers.length - 1;
        }
        self.saveState();
        self.renderLayersList();
        self.render();
      }, 250);
    },

    duplicateLayer: function (id) {
      this.layerCount++;
      const index = this.layers.findIndex(l => l.id === id);
      if (index === -1) return;
      
      const sourceLayer = this.layers[index];

      const buffer = document.createElement('canvas');
      buffer.width = this.width;
      buffer.height = this.height;
      const bCtx = buffer.getContext('2d');

      bCtx.drawImage(sourceLayer.buffer, 0, 0);

      const duplicated = {
        id: Date.now() + Math.random(),
        name: `${sourceLayer.name} Copy`,
        visible: true,
        buffer: buffer,
        ctx: bCtx,
        isNew: true
      };

      this.layers.splice(index, 0, duplicated);
      this.currentLayer = index;
      this.saveState();
      this.renderLayersList();
      this.render();
    },

    buildPalette: function () {
      const grid = $('#paletteGrid');
      grid.empty();

      this.defaultPalette.forEach(color => {
        const swatch = $('<div>')
          .addClass('color-swatch')
          .css('background-color', color)
          .attr('data-color', color);

        if (color.toLowerCase() === this.currentColor.toLowerCase()) {
          swatch.addClass('selected');
        }

        grid.append(swatch);
      });
    },

    bindEvents: function () {
      const self = this;

      $(document).on('input change', '#colorPicker', function () {
        const color = $(this).val();
        self.setCurrentColor(color);
      });

      $(document).on('click', '.color-swatch', function () {
        const color = $(this).data('color');
        self.setCurrentColor(color);
      });

      $('.tool-card').on('click', function () {
        $('.tool-card').removeClass('active');
        $(this).addClass('active');
        self.currentTool = $(this).data('tool');
      });

      $(this.canvas).on('mousedown', function (e) {
        self.isDrawing = true;
        self.handleDraw(e);
      });

      $(this.canvas).on('mousemove', function (e) {
        const coords = self.getCanvasCoordinates(e);
        $('#canvasCoords').text(`X: ${coords.x}, Y: ${coords.y}`);

        if (self.isDrawing) {
          self.handleDraw(e);
        }
      });

      $(this.canvas).on('touchstart', function (e) {
        self.isDrawing = true;
        const touch = e.originalEvent.touches[0];
        self.handleDraw(touch);
        e.preventDefault();
      });

      $(this.canvas).on('touchmove', function (e) {
        if (!self.isDrawing) return;
        const touch = e.originalEvent.touches[0];
        const coords = self.getCanvasCoordinates(touch);
        $('#canvasCoords').text(`X: ${coords.x}, Y: ${coords.y}`);
        self.handleDraw(touch);
        e.preventDefault();
      });

      $(document).on('mouseup touchend', function () {
        if (self.isDrawing) {
          self.isDrawing = false;
          self.saveState();
        }
      });

      $(document).on('click', '#undoBtn', () => this.undo());
      $(document).on('click', '#redoBtn', () => this.redo());
      $(document).on('click', '#clearBtn', () => this.clearCanvas());
      $(document).on('click', '#exportBtn', () => this.exportPNG());
      
      $(document).on('click', '#toggleGridBtn', function () {
        self.showGrid = !self.showGrid;
        $('#toggleGridBtn, .mobile-actions-wrapper #toggleGridBtn').toggleClass('active', self.showGrid);
        self.render();
      });
      $(document).on('click', '.copy-prem-btn', function () {
        const safeCommand = $(this).data('cli');
        const $btn = $(this);
        
        navigator.clipboard.writeText(safeCommand).then(() => {
          const originalHtml = $btn.html();
          
          $btn.addClass('copied');
          $btn.html('<i class="fa-solid fa-check check-icon"></i> Copied!');
          
          setTimeout(() => {
            $btn.removeClass('copied');
            $btn.html(originalHtml);
          }, 2000);
        });
      });

      $('#resizeBtn').on('click', () => {
        const w = parseInt($('#canvasWidth').val());
        const h = parseInt($('#canvasHeight').val());
        if (w >= 4 && w <= 128 && h >= 4 && h <= 128) {
          this.width = w;
          this.height = h;
          this.initLayers();
          this.calculateAutoPixelSize();
          this.resizeCanvas();
          this.history = [];
          this.historyIndex = -1;
          this.saveState();
        }
      });

      $('.bg-switch-btn').on('click', function () {
        $('.bg-switch-btn').removeClass('active');
        $(this).addClass('active');

        const bgType = $(this).data('bg');
        const wrapper = $('.canvas-wrapper');

        wrapper.removeClass('bg-black bg-white');
        if (bgType === 'black') {
          wrapper.addClass('bg-black');
        } else if (bgType === 'white') {
          wrapper.addClass('bg-white');
        }
      });

      $(document).on('click', '#addLayerBtn', () => this.addLayer());

      $(document).on('click', '.layer-item', function (e) {
        if ($(e.target).closest('.layer-visibility, .layer-action').length) return;
        const id = $(this).data('id');
        const targetIndex = self.layers.findIndex(l => l.id === id);
        if (targetIndex !== -1) {
          self.currentLayer = targetIndex;
          self.renderLayersList();
        }
      });

      $(document).on('click', '.layer-visibility', function () {
        const id = $(this).closest('.layer-item').data('id');
        const layer = self.layers.find(l => l.id === id);
        if (layer) {
          layer.visible = !layer.visible;
          self.renderLayersList();
          self.render();
        }
      });

      $(document).on('click', '.layer-action', function () {
        const id = $(this).closest('.layer-item').data('id');
        const action = $(this).attr('title');
        if (action === 'Delete') self.deleteLayer(id);
        if (action === 'Duplicate') self.duplicateLayer(id);
      });

      $('#toggleLeftSidebar').on('click', () => {
        $('#rightSidebar').removeClass('open');
        $('#leftSidebar').toggleClass('open');
      });
      
      $('#toggleRightSidebar').on('click', () => {
        $('#leftSidebar').removeClass('open');
        $('#rightSidebar').toggleClass('open');
      });

      $('#closeLeftSidebar').on('click', () => $('#leftSidebar').removeClass('open'));
      $('#closeRightSidebar').on('click', () => $('#rightSidebar').removeClass('open'));

      $(document).on('click', '#faqBtn', function (e) {
        e.preventDefault();
        $('#faqModal').addClass('open');
      });

      $(document).on('click', '#closeFaqModal', function () {
        $('#faqModal').removeClass('open');
      });

      $(document).on('click', '#faqModal', function (e) {
        if ($(e.target).hasClass('modal-overlay')) {
          $('#faqModal').removeClass('open');
        }
      });

      $(document).on('keydown', function (e) {
        if ($(e.target).is('input')) return;
        const key = e.key.toLowerCase();
        if (e.ctrlKey && key === 'z') { e.preventDefault(); self.undo(); }
        if (e.ctrlKey && key === 'y') { e.preventDefault(); self.redo(); }
        if (key === 'p') $('.tool-card[data-tool="pencil"]').click();
        if (key === 'e') $('.tool-card[data-tool="eraser"]').click();
        if (key === 'g') $('.tool-card[data-tool="bucket"]').click();
        if (key === 'i') $('.tool-card[data-tool="picker"]').click();
        if (e.key === 'Escape') $('#faqModal').removeClass('open');
      });
    },

    setCurrentColor: function (color) {
      this.currentColor = color;
      $('#colorPicker').val(color);
      $('#colorPreviewCircle').css('background-color', color);
      $('#colorHexText').text(color.toUpperCase());

      $('.color-swatch').removeClass('selected');
      $(`.color-swatch[data-color="${color.toLowerCase()}"]`).addClass('selected');
      $(`.color-swatch[data-color="${color.toUpperCase()}"]`).addClass('selected');
    },

    getCanvasCoordinates: function (e) {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX ?? e.pageX ?? 0;
      const clientY = e.clientY ?? e.pageY ?? 0;
      
      const x = Math.floor((clientX - rect.left) / this.pixelSize);
      const y = Math.floor((clientY - rect.top) / this.pixelSize);
      return {
        x: Math.max(0, Math.min(this.width - 1, x)),
        y: Math.max(0, Math.min(this.height - 1, y))
      };
    },

    handleDraw: function (e) {
      const coords = this.getCanvasCoordinates(e);
      const activeLayer = this.layers[this.currentLayer];

      if (!activeLayer || !activeLayer.visible) return;

      if (this.currentTool === 'pencil') {
        activeLayer.ctx.fillStyle = this.currentColor;
        activeLayer.ctx.fillRect(coords.x, coords.y, 1, 1);
        this.render();
      } else if (this.currentTool === 'eraser') {
        activeLayer.ctx.clearRect(coords.x, coords.y, 1, 1);
        this.render();
      } else if (this.currentTool === 'bucket') {
        this.floodFill(coords.x, coords.y, this.currentColor);
        this.render();
      } else if (this.currentTool === 'picker') {
        const color = this.getPixelColor(coords.x, coords.y);
        if (color) this.setCurrentColor(color);
      }
    },

    getPixelColor: function (x, y) {
      for (let i = 0; i < this.layers.length; i++) {
        const layer = this.layers[i];
        if (!layer.visible) continue;
        const imgData = layer.ctx.getImageData(x, y, 1, 1).data;
        if (imgData[3] > 0) {
          return "#" + ("000000" + ((imgData[0] << 16) | (imgData[1] << 8) | imgData[2]).toString(16)).slice(-6);
        }
      }
      return null;
    },

    floodFill: function (startX, startY, fillHex) {
      const activeLayer = this.layers[this.currentLayer];
      const ctx = activeLayer.ctx;
      const imgData = ctx.getImageData(0, 0, this.width, this.height);
      const data = imgData.data;

      const targetRGBA = this.getRGBAAt(data, startX, startY);
      const fillRGBA = this.hexToRGBA(fillHex);

      if (this.colorsMatch(targetRGBA, fillRGBA)) return;

      const queue = [[startX, startY]];
      const visited = new Set();

      while (queue.length > 0) {
        const [cx, cy] = queue.shift();
        const key = `${cx},${cy}`;

        if (visited.has(key)) continue;
        visited.add(key);

        const currentRGBA = this.getRGBAAt(data, cx, cy);

        if (this.colorsMatch(currentRGBA, targetRGBA)) {
          this.setRGBAAt(data, cx, cy, fillRGBA);

          if (cx > 0) queue.push([cx - 1, cy]);
          if (cx < this.width - 1) queue.push([cx + 1, cy]);
          if (cy > 0) queue.push([cx, cy - 1]);
          if (cy < this.height - 1) queue.push([cx, cy + 1]);
        }
      }
      ctx.putImageData(imgData, 0, 0);
    },

    getRGBAAt: function(data, x, y) {
      const idx = (y * this.width + x) * 4;
      return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
    },

    setRGBAAt: function(data, x, y, rgba) {
      const idx = (y * this.width + x) * 4;
      data[idx] = rgba[0];
      data[idx + 1] = rgba[1];
      data[idx + 2] = rgba[2];
      data[idx + 3] = rgba[3];
    },

    colorsMatch: function (c1, c2, tolerance = 2) {
      return Math.abs(c1[0] - c2[0]) <= tolerance &&
        Math.abs(c1[1] - c2[1]) <= tolerance &&
        Math.abs(c1[2] - c2[2]) <= tolerance &&
        Math.abs(c1[3] - c2[3]) <= tolerance;
    },

    hexToRGBA: function (hex) {
      const c = hex.substring(1);
      const rgb = parseInt(c, 16);
      return [(rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF, 255];
    },

    render: function () {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      for (let i = this.layers.length - 1; i >= 0; i--) {
        const layer = this.layers[i];
        if (layer.visible) {
          this.ctx.drawImage(
            layer.buffer,
            0, 0, this.width, this.height,
            0, 0, this.canvas.width, this.canvas.height
          );
        }
      }

      if (this.showGrid) {
        this.drawGrid();
      }
    },

    drawGrid: function () {
      this.ctx.strokeStyle = 'rgba(128, 128, 128, 0.2)';
      this.ctx.lineWidth = 1;

      const step = this.pixelSize;

      for (let x = 0; x <= this.canvas.width; x += step) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.canvas.height && this.ctx.lineTo(x, this.canvas.height);
        this.ctx.stroke();
      }

      for (let y = 0; y <= this.canvas.height; y += step) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.canvas.width && this.ctx.lineTo(this.canvas.width, y);
        this.ctx.stroke();
      }
    },

    renderLayersList: function () {
      const list = $('#layersList');
      list.empty();
      for (let i = 0; i < this.layers.length; i++) {
        const layer = this.layers[i];

        const visibilityIcon = layer.visible ?
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' :
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/></svg>';

        const layerInfo = $('<div>').addClass('layer-info');
        layerInfo.append($('<button>').addClass('layer-visibility').html(visibilityIcon));
        layerInfo.append($('<span>').addClass('layer-name').text(layer.name));

        const layerActions = $('<div>').addClass('layer-actions');
        layerActions.append($('<button>').addClass('layer-action').attr('title', 'Duplicate').html('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'));
        layerActions.append($('<button>').addClass('layer-action').attr('title', 'Delete').html('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'));

        const item = $('<div>').addClass('layer-item').attr('data-id', layer.id).append(layerInfo).append(layerActions);
        
        if (i === this.currentLayer) {
          item.addClass('active');
        }

        list.append(item);

        if (layer.isNew) {
          item.addClass('appearing');
          item.each(function() { this.offsetHeight; });
          item.removeClass('appearing');
          delete layer.isNew;
        }
      }
    },

    saveState: function () {
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }

      const stateLayers = this.layers.map(layer => {
        const bufferCopy = document.createElement('canvas');
        bufferCopy.width = this.width;
        bufferCopy.height = this.height;
        bufferCopy.getContext('2d').drawImage(layer.buffer, 0, 0);
        return {
          id: layer.id,
          name: layer.name,
          visible: layer.visible,
          buffer: bufferCopy
        };
      });

      this.history.push({
        layers: stateLayers,
        currentLayer: this.currentLayer
      });

      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
      this.historyIndex = this.history.length - 1;
      this.updateUI();
      this.persistToLocalStorage();
    },

    persistToLocalStorage: function () {
      try {
        const layersData = this.layers.map(layer => ({
          id: layer.id,
          name: layer.name,
          visible: layer.visible,
          data: layer.buffer.toDataURL()
        }));
        const state = {
          width: this.width,
          height: this.height,
          currentLayer: this.currentLayer,
          currentColor: this.currentColor,
          layers: layersData
        };
        localStorage.setItem('pixelStudio_save', JSON.stringify(state));
      } catch (e) {}
    },

    loadFromLocalStorage: function () {
      try {
        const raw = localStorage.getItem('pixelStudio_save');
        if (!raw) return false;
        const state = JSON.parse(raw);

        this.width = state.width || 32;
        this.height = state.height || 32;
        this.currentLayer = state.currentLayer || 0;

        const loadLayer = (ld) => new Promise(resolve => {
          const buffer = document.createElement('canvas');
          buffer.width = this.width;
          buffer.height = this.height;
          const ctx = buffer.getContext('2d');
          const img = new Image();
          img.onload = () => { ctx.drawImage(img, 0, 0); resolve({ id: ld.id, name: ld.name, visible: ld.visible, buffer, ctx }); };
          img.src = ld.data;
        });

        Promise.all(state.layers.map(loadLayer)).then(layers => {
          this.layers = layers;
          if (state.currentColor) this.setCurrentColor(state.currentColor);
          $('#canvasWidth').val(this.width);
          $('#canvasHeight').val(this.height);
          this.calculateAutoPixelSize();
          this.resizeCanvas();
          this.renderLayersList();
          this.history = [];
          this.historyIndex = -1;
          this.saveState();
        });

        return true;
      } catch (e) {
        return false;
      }
    },

    undo: function () {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.restoreState(this.history[this.historyIndex]);
      }
    },

    redo: function () {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.restoreState(this.history[this.historyIndex]);
      }
    },

    restoreState: function (state) {
      this.currentLayer = state.currentLayer;
      this.layers = state.layers.map(historyLayer => {
        const buffer = document.createElement('canvas');
        buffer.width = this.width;
        buffer.height = this.height;
        const ctx = buffer.getContext('2d');
        ctx.drawImage(historyLayer.buffer, 0, 0);
        return {
          id: historyLayer.id,
          name: historyLayer.name,
          visible: historyLayer.visible,
          buffer: buffer,
          ctx: ctx
        };
      });
      this.renderLayersList();
      this.render();
      this.updateUI();
    },

    clearCanvas: function () {
      const activeLayer = this.layers[this.currentLayer];
      if (!activeLayer) return;
      activeLayer.ctx.clearRect(0, 0, this.width, this.height);
      this.saveState();
      this.render();
    },

    updateUI: function () {
      const uDisabled = this.historyIndex <= 0;
      const rDisabled = this.historyIndex >= this.history.length - 1;
      
      $('#undoBtn, .mobile-actions-wrapper #undoBtn').prop('disabled', uDisabled);
      $('#redoBtn, .mobile-actions-wrapper #redoBtn').prop('disabled', rDisabled);
    },

    bindImportEvents: function () {
      const self = this;

      $(document).on('click', '#importBtn', function () {
        $('#importFileInput').click();
      });

      $(document).on('change', '#importFileInput', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
          const img = new Image();
         img.onload = function () {
            const activeLayer = self.layers[self.currentLayer];
            if (!activeLayer) return;
            
            let w = img.width;
            let h = img.height;
            
            if (w > self.width && w % self.width === 0 && h % self.height === 0) {
              const scale = w / self.width;
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = w;
              tempCanvas.height = h;
              const tempCtx = tempCanvas.getContext('2d');
              tempCtx.drawImage(img, 0, 0);
              const imgData = tempCtx.getImageData(0, 0, w, h).data;
              
              activeLayer.ctx.clearRect(0, 0, self.width, self.height);
              for (let y = 0; y < self.height; y++) {
                for (let x = 0; x < self.width; x++) {
                  const px = Math.floor(x * scale + scale / 2);
                  const py = Math.floor(y * scale + scale / 2);
                  const idx = (py * w + px) * 4;
                  if (imgData[idx + 3] > 0) {
                    activeLayer.ctx.fillStyle = 'rgba(' + imgData[idx] + ',' + imgData[idx + 1] + ',' + imgData[idx + 2] + ',' + (imgData[idx + 3] / 255) + ')';
                    activeLayer.ctx.fillRect(x, y, 1, 1);
                  }
                }
              }
            } else {
              activeLayer.ctx.imageSmoothingEnabled = false;
              activeLayer.ctx.webkitImageSmoothingEnabled = false;
              activeLayer.ctx.mozImageSmoothingEnabled = false;
              activeLayer.ctx.clearRect(0, 0, self.width, self.height);
              activeLayer.ctx.drawImage(img, 0, 0, self.width, self.height);
            }
            self.saveState();
            self.render();
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        $(this).val('');
      });

      $(document).on('click', '#newBtn', function () {
        if (!confirm('Start a new canvas? Unsaved progress will be lost.')) return;
        localStorage.removeItem('pixelStudio_save');
        self.width = 32;
        self.height = 32;
        $('#canvasWidth').val(32);
        $('#canvasHeight').val(32);
        self.initLayers();
        self.calculateAutoPixelSize();
        self.resizeCanvas();
        self.history = [];
        self.historyIndex = -1;
        self.saveState();
      });
    },

    exportPNG: function () {
      const scaleFactor = 16;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = this.width * scaleFactor;
      exportCanvas.height = this.height * scaleFactor;
      const eCtx = exportCanvas.getContext('2d');

      eCtx.imageSmoothingEnabled = false;
      eCtx.webkitImageSmoothingEnabled = false;
      eCtx.mozImageSmoothingEnabled = false;

      for (let i = this.layers.length - 1; i >= 0; i--) {
        const layer = this.layers[i];
        if (layer.visible) {
          eCtx.drawImage(
            layer.buffer,
            0, 0, this.width, this.height,
            0, 0, exportCanvas.width, exportCanvas.height
          );
        }
      }
      const dataUrl = exportCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'pixel-art.png';
      link.href = dataUrl;
      link.click();
    }
  };

  editor.init();
});