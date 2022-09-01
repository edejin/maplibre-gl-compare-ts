import syncMove from '@mapbox/mapbox-gl-sync-move';
import {EventEmitter, Listener} from 'events';
import {Map} from 'maplibre-gl';

export type ListenerFunction = Listener;

export type Orientation = 'horizontal' | 'vertical';

export interface CompareOptions {
  orientation?: Orientation;
  mousemove?: boolean;
}

export class Compare {
  private ev = new EventEmitter();
  private swiper = document.createElement('div');
  private controlContainer = document.createElement('div');
  private readonly clearSync: () => void;
  currentPosition?: number;
  private initialSelectValue?: string;

  /**
   *
   * @param {Map} mapA The first MapLibre GL Map
   * @param {Map} mapB The second MapLibre GL Map
   * @param {string|HTMLElement} container An HTML Element, or an element selector string for the compare container. It should be a wrapper around the two map Elements.
   * @param {Object} options
   * @param {string} [options.orientation=vertical] The orientation of the compare slider. `vertical` creates a vertical slider bar to compare one map on the left (map A) with another map on the right (map B). `horizontal` creates a horizontal slider bar to compare on mop on the top (map A) and another map on the bottom (map B).
   * @param {boolean} [options.mousemove=false] If `true` the compare slider will move with the cursor, otherwise the slider will need to be dragged to move.
   * @example
   * var compare = new maplibregl.Compare(beforeMap, afterMap, '#wrapper', {
   *   orientation: 'vertical',
   *   mousemove: true
   * });
   * @see [Swipe between maps](https://maplibre.org/maplibre-gl-js-docs/plugins/)
   */
  constructor(private mapA: Map, private mapB: Map, container: string | HTMLElement, private options: CompareOptions = {}) {
    this.swiper.className = this.horizontal ? 'compare-swiper-horizontal' : 'compare-swiper-vertical';

    this.controlContainer.className = this.horizontal ? 'maplibregl-compare maplibregl-compare-horizontal' : 'maplibregl-compare';

    this.controlContainer.appendChild(this.swiper);

    if (typeof container === 'string' && document.body.querySelectorAll) {
      // Get container with a selector
      const [appendTarget] = document.body.querySelectorAll(container);
      if (!appendTarget) {
        throw new Error('Cannot find element with specified container selector.');
      }
      appendTarget.appendChild(this.controlContainer);
    } else if (container instanceof Element && container.appendChild) {
      // Get container directly
      container.appendChild(this.controlContainer);
    } else {
      throw new Error('Invalid container specified. Must be CSS selector or HTML element.');
    }

    const swiperPosition =
      (this.horizontal ? this.bounds.height : this.bounds.width) / 2;

    this.setPosition(swiperPosition);

    this.clearSync = syncMove(this.mapA, this.mapB);

    this.mapB.on('resize', this.onResize);

    if (this.options.mousemove) {
      this.mapA.getContainer().addEventListener('mousemove', this.onMove);
      this.mapB.getContainer().addEventListener('mousemove', this.onMove);
    }

    this.swiper.addEventListener('mousedown', this.onDown);
    this.swiper.addEventListener('touchstart', this.onDown);
  }

  private get horizontal(): boolean {
    return this.options.orientation === 'horizontal';
  }

  private get bounds(): DOMRect {
    return this.mapB?.getContainer()?.getBoundingClientRect();
  }

  private setPointerEvents(v: 'auto' | 'none') {
    this.controlContainer.style.pointerEvents = v;
    this.swiper.style.pointerEvents = v;
  }

  private setPosition(x: number) {
    const t = Math.min(x, this.horizontal ? this.bounds.height : this.bounds.width);

    if (this.horizontal) {
      const pos = `translate(0, ${t}px)`;
      this.controlContainer.style.transform = pos;
      this.controlContainer.style.webkitTransform = pos;
      this.mapA.getContainer().style.clip = `rect(0, 999em, ${t}px, 0)`;
      this.mapB.getContainer().style.clip = `rect(${t}px, 999em, ${this.bounds.height}px,0)`;
    } else {
      const pos = `translate(${t}px, 0)`;
      this.controlContainer.style.transform = pos;
      this.controlContainer.style.webkitTransform = pos;
      this.mapA.getContainer().style.clip = `rect(0, ${t}px, ${this.bounds.height}px, 0)`;
      this.mapB.getContainer().style.clip = `rect(0, 999em, ${this.bounds.height}px, ${t}px)`;
    }

    this.currentPosition = t;
  }

  onDown = (e: MouseEvent | TouchEvent): void => {
    if ((e as TouchEvent).touches) {
      document.addEventListener('touchmove', this.onMove);
      document.addEventListener('touchend', this.onTouchEnd);
    } else {
      document.addEventListener('mousemove', this.onMove);
      document.addEventListener('mouseup', this.onMouseUp);
    }
    this.initialSelectValue = this.controlContainer.style.userSelect;
    this.controlContainer.style.userSelect = 'none';
  };

  onMove = (e: MouseEvent | TouchEvent): void => {
    if (this.options.mousemove) {
      this.setPointerEvents((e as TouchEvent).touches ? 'auto' : 'none');
    }

    if (this.horizontal) {
      this.setPosition(this.getY(e));
    } else {
      this.setPosition(this.getX(e));
    }
  };

  onMouseUp = (): void => {
    document.removeEventListener('mousemove', this.onMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    this.fire('slideend', {currentPosition: this.currentPosition});
    this.controlContainer.style.userSelect = this.initialSelectValue!;
  };

  onTouchEnd = (): void => {
    document.removeEventListener('touchmove', this.onMove);
    document.removeEventListener('touchend', this.onTouchEnd);
    this.fire('slideend', {currentPosition: this.currentPosition});
    this.controlContainer.style.userSelect = this.initialSelectValue!;
  };

  onResize = (): void => {
    if (this.currentPosition) {
      this.setPosition(this.currentPosition);
    }
  };

  private getX(e: MouseEvent | TouchEvent): number {
    const t: Touch | MouseEvent = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent);
    const x = (t as MouseEvent).clientX - this.bounds.left;
    return Math.max(Math.min(x, this.bounds.width), 0);
  }

  private getY(e: MouseEvent | TouchEvent): number {
    const t: Touch | MouseEvent = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent);
    const y = (t as MouseEvent).clientY - this.bounds.top;
    return Math.max(Math.min(y, this.bounds.height), 0);
  }

  /**
   * Set the position of the slider.
   *
   * @param {number} x Slider position in pixels from left/top.
   */
  setSlider(x: number): void {
    this.setPosition(x);
  }

  /**
   * Adds a listener for events of a specified type.
   *
   * @param {string} type The event type to listen for; one of `slideend`.
   * @param {ListenerFunction} fn The function to be called when the event is fired.
   * @returns {Compare} `this`
   */
  on(type: string, fn: ListenerFunction): Compare {
    this.ev.on(type, fn);
    return this;
  }

  /**
   * Fire an event of a specified type.
   *
   * @param {string} type The event type to fire; one of `slideend`.
   * @param {Object} data Data passed to the event listener.
   * @returns {Compare} `this`
   */
  fire(type: string, data: any): Compare {
    this.ev.emit(type, data);
    return this;
  }

  /**
   * Removes an event listener previously added with `Compare#on`.
   *
   * @param {string} type The event type previously used to install the listener.
   * @param {ListenerFunction} fn The function previously installed as a listener.
   * @returns {Compare} `this`
   */
  off(type: string, fn: ListenerFunction): Compare {
    this.ev.removeListener(type, fn);
    return this;
  }

  remove(): void {
    this.clearSync();
    this.mapB.off('resize', this.onResize);
    const aContainer = this.mapA.getContainer();
    aContainer?.style.removeProperty('clip');
    aContainer?.removeEventListener('mousemove', this.onMove);

    const bContainer = this.mapB.getContainer();
    bContainer?.style.removeProperty('clip');
    bContainer?.removeEventListener('mousemove', this.onMove);

    this.swiper.removeEventListener('mousedown', this.onDown);
    this.swiper.removeEventListener('touchstart', this.onDown);
    this.controlContainer.remove();
  }
}
