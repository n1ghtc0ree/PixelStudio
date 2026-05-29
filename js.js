
$(document).ready(function () {
  console.log('jQuery loaded');

  const editor = {
    canvas: $('#pixelCanvas')[0],
    ctx: null,
    width: 64,
    height: 64,
    pixelSize: 16,
    zoom: 1,
    currentColor: '#000000',
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

      this.initLayers();
      this.buildPalette();
      this.bindEvents();
      this.saveState();
      this.updateUI();

      setTimeout(() => {
        this.calculateAutoPixelSize();
        this.resizeCanvas();
      }, 50);

      $(window).on('resize', () => {
        if (this.zoom === 1) {
          this.calculateAutoPixelSize();
          this.resizeCanvas();
        }
      });
    },

    calculateAutoPixelSize: function () {
      const wrapper = $('.canvas-wrapper');
      let maxW = wrapper.width();
      let maxH = wrapper.height();

      if (!maxW || maxW <= 0) maxW = window.innerWidth - 500;
      if (!maxH || maxH <= 0) maxH = window.innerHeight - 150;

      maxW = maxW - 48;
      maxH = maxH - 48;

      const sizeW = Math.floor(maxW / this.width);
      const sizeH = Math.floor(maxH / this.height);

      this.pixelSize = Math.max(2, Math.min(64, Math.min(sizeW, sizeH)));
    },

    resizeCanvas: function () {
      const displayWidth = this.width * this.pixelSize * this.zoom;
      const displayHeight = this.height * this.pixelSize * this.zoom;

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
      this.layerCount++;
      const layerName = name || `Layer ${this.layerCount}`;

      const buffer = document.createElement('canvas');
      buffer.width = this.width;
      buffer.height = this.height;
      const bCtx = buffer.getContext('2d');

      const newLayer = {
        id: Date.now() + Math.random(),
        name: layerName,
        visible: true,
        buffer: buffer,
        ctx: bCtx
      };

      this.layers.splice(this.currentLayer, 0, newLayer);
      this.renderLayersList();
      this.render();
    },

    deleteLayer: function (index) {
      if (this.layers.length <= 1) return;
      this.layers.splice(index, 1);
      if (this.currentLayer >= this.layers.length) {
        this.currentLayer = this.layers.length - 1;
      }
      this.saveState();
      this.renderLayersList();
      this.render();
    },

    duplicateLayer: function (index) {
      this.layerCount++;
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
        ctx: bCtx
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

      $('#colorPicker').on('input change', function () {
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

      $(document).on('mouseup', function () {
        if (self.isDrawing) {
          self.isDrawing = false;
          self.saveState();
        }
      });

      $(this.canvas).on('mousemove', function (e) {
        const coords = self.getCanvasCoordinates(e);
        $('#canvasCoords').text(`X: ${coords.x}, Y: ${coords.y}`);

        if (self.isDrawing) {
          self.handleDraw(e);
        }
      });

      $('#undoBtn').on('click', () => this.undo());
      $('#redoBtn').on('click', () => this.redo());
      $('#clearBtn').on('click', () => this.clearCanvas());

      $('#toggleGridBtn').on('click', function () {
        self.showGrid = !self.showGrid;
        $(this).toggleClass('active', self.showGrid);
        self.render();
      });

      $('#resizeBtn').on('click', () => {
        const w = parseInt($('#canvasWidth').val());
        const h = parseInt($('#canvasHeight').val());
        if (w >= 4 && w <= 128 && h >= 4 && h <= 128) {
          this.width = w;
          this.height = h;
          this.initLayers();
          this.calculateAutoPixelSize();
          this.zoom = 1;
          $('#zoomDisplay').text('100%');
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

      $('#zoomInBtn').on('click', () => {
        if (this.zoom < 8) {
          this.zoom *= 1.5;
          this.resizeCanvas();
          $('#zoomDisplay').text(`${Math.round(this.zoom * 100)}%`);
        }
      });

      $('#zoomOutBtn').on('click', () => {
        if (this.zoom > 0.25) {
          this.zoom /= 1.5;
          this.resizeCanvas();
          $('#zoomDisplay').text(`${Math.round(this.zoom * 100)}%`);
        }
      });

      $('#exportBtn').on('click', () => this.exportPNG());
      $('#addLayerBtn').on('click', () => this.addLayer());

      $(document).on('click', '.layer-item', function (e) {
        if ($(e.target).closest('.layer-visibility, .layer-action').length) return;
        self.currentLayer = $('.layer-item').length - 1 - $(this).index();
        self.renderLayersList();
      });

      $(document).on('click', '.layer-visibility', function () {
        const idx = $('.layer-item').length - 1 - $(this).closest('.layer-item').index();
        self.layers[idx].visible = !self.layers[idx].visible;
        self.renderLayersList();
        self.render();
      });

      $(document).on('click', '.layer-action', function () {
        const action = $(this).attr('title');
        const idx = $('.layer-item').length - 1 - $(this).closest('.layer-item').index();
        if (action === 'Delete') self.deleteLayer(idx);
        if (action === 'Duplicate') self.duplicateLayer(idx);
      });

      $('#toggleLeftSidebar').on('click', () => $('#leftSidebar').toggleClass('open'));
      $('#toggleRightSidebar').on('click', () => $('#rightSidebar').toggleClass('open'));

      $(document).on('keydown', function (e) {
        if ($(e.target).is('input')) return;
        const key = e.key.toLowerCase();
        if (e.ctrlKey && key === 'z') { e.preventDefault(); self.undo(); }
        if (e.ctrlKey && key === 'y') { e.preventDefault(); self.redo(); }
        if (key === 'p') $('.tool-card[data-tool="pencil"]').click();
        if (key === 'e') $('.tool-card[data-tool="eraser"]').click();
        if (key === 'g') $('.tool-card[data-tool="bucket"]').click();
        if (key === 'i') $('.tool-card[data-tool="picker"]').click();
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
      const x = Math.floor((e.clientX - rect.left) / (this.pixelSize * this.zoom));
      const y = Math.floor((e.clientY - rect.top) / (this.pixelSize * this.zoom));
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

    getRGBAAt: function (data, x, y) {
      const idx = (y * this.width + x) * 4;
      return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
    },

    setRGBAAt: function (data, x, y, rgba) {
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

      const step = this.pixelSize * this.zoom;

      for (let x = 0; x <= this.canvas.width; x += step) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.canvas.height);
        this.ctx.stroke();
      }

      for (let y = 0; y <= this.canvas.height; y += step) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.canvas.width, y);
        this.ctx.stroke();
      }
    },

    renderLayersList: function () {
      const list = $('#layersList');
      list.empty();

      for (let i = 0; i < this.layers.length; i++) {
        const layer = this.layers[i];
        const index = i;

        const visibilityIcon = layer.visible ?
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' :
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/></svg>';

        const layerInfo = $('<div>').addClass('layer-info');
        layerInfo.append($('<button>').addClass('layer-visibility').attr('data-visible', layer.visible).html(visibilityIcon));
        layerInfo.append($('<span>').addClass('layer-name').text(layer.name));

        const layerActions = $('<div>').addClass('layer-actions');
        layerActions.append($('<button>').addClass('layer-action').attr('title', 'Duplicate').html('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'));
        layerActions.append($('<button>').addClass('layer-action').attr('title', 'Delete').html('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'));

        const item = $('<div>').addClass('layer-item').append(layerInfo).append(layerActions);
        if (index === this.currentLayer) {
          item.addClass('active');
        }

        list.append(item);
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
          id: Date.now() + Math.random(),
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
      $('#undoBtn').prop('disabled', this.historyIndex <= 0);
      $('#redoBtn').prop('disabled', this.historyIndex >= this.history.length - 1);
    },

    exportPNG: function () {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = this.width;
      exportCanvas.height = this.height;
      const eCtx = exportCanvas.getContext('2d');

      for (let i = this.layers.length - 1; i >= 0; i--) {
        const layer = this.layers[i];
        if (layer.visible) {
          eCtx.drawImage(layer.buffer, 0, 0);
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