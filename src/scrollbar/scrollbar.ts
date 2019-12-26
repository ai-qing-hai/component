import { addEventListener } from '@antv/dom-util';
import { Event } from '@antv/g-base';
import { IGroup, IShape } from '@antv/g-base/lib/interfaces';
import { clamp, get, noop } from '@antv/util';
import GroupComponent from '../abstract/group-component';
import { ISlider } from '../interfaces';
import { GroupComponentCfg, Range } from '../types';

export interface ScrollBarStyle {
  trackColor: string;
  thumbColor: string;
  size: number;
  lineCap: string;
}

export interface ScrollBarTheme {
  default?: Partial<Readonly<ScrollBarStyle>>;
  hover?: Partial<Readonly<ScrollBarStyle>>;
}

const DEFAULT_STYLE: ScrollBarStyle = {
  trackColor: 'rgba(0,0,0,0)',
  thumbColor: 'rgba(0,0,0,0.15)',
  size: 8,
  lineCap: 'round',
};

export const DEFAULT_THEME: ScrollBarTheme = {
  // 默认样式
  default: DEFAULT_STYLE,
  // 鼠标 hover 的样式
  hover: {
    thumbColor: 'rgba(0,0,0,0.2)',
  },
};

export interface ScrollbarCfg extends GroupComponentCfg {
  // scrollBar 的位置
  x: number;
  y: number;
  // 滚动条的布局，横向 | 纵向, 非必传，默认为 false(纵向)
  isHorizontal?: boolean;
  // 滑道长度，必传
  trackLen: number;
  // 滑块长度，必传
  thumbLen: number;
  // 滑块的最小长度，非必传，默认值为 20
  minThumbLen?: number;
  // 滑块相对滑道的偏移, 非必传，默认值为 0
  thumbOffset?: number;
  // 滚动条样式，非必传
  theme?: ScrollBarTheme;

  minLimit?: number;
  maxLimit?: number;
}

export class Scrollbar extends GroupComponent<ScrollbarCfg> implements ISlider {
  public cfg: ScrollbarCfg;
  // 通过拖拽开始的事件是 mousedown 还是 touchstart 来决定是移动端还是 pc 端
  private isMobile: boolean;
  private clearEvents = noop;
  private startPos: number;

  public setRange(min: number, max: number) {
    this.set('minLimit', min);
    this.set('maxLimit', max);
  }

  public getRange(): Range {
    const min: number = this.get('minLimit');
    const max: number = this.get('maxLimit');

    return { min, max };
  }

  public setValue(value: number) {
    const originalValue = this.getValue();
    this.update({
      thumbOffset: this.get('trackLen') - this.get('thumbLen') * clamp(value, 0, 1),
    });
    this.delegateEmit('valuechange', {
      originalValue,
      value: this.getValue(),
    });
  }

  public getValue(): number {
    return clamp(this.get('thumbOffset') / (this.get('trackLen') - this.get('thumbLen')), 0, 1);
  }

  public getDefaultCfg() {
    const cfg = super.getDefaultCfg();
    return {
      ...cfg,
      name: 'scrollbar',
      isHorizontal: true,
      minThumbLen: 20,
      thumbOffset: 0,
      theme: DEFAULT_THEME,
    };
  }

  protected renderInner(group: IGroup) {
    const track = this.renderTrackShape(group);
    const thumb = this.renderThumbShape(group);

    this.bindEvents(group, track, thumb);
  }

  protected applyOffset() {
    this.moveElementTo(this.get('group'), {
      x: this.get('x'),
      y: this.get('y'),
    });
  }

  // 创建滑道的 shape
  private renderTrackShape(group: IGroup) {
    const { trackLen, theme = { default: {} } } = this.cfg;
    const { lineCap, trackColor, size } = theme.default;
    const attrs = this.get('isHorizontal')
      ? {
          x1: 0 + size / 2,
          y1: size / 2,
          x2: trackLen - size / 2,
          y2: size / 2,
          lineWidth: size,
          stroke: trackColor,
          lineCap,
        }
      : {
          x1: size / 2,
          y1: 0 + size / 2,
          x2: size / 2,
          y2: trackLen - size / 2,
          lineWidth: size,
          stroke: trackColor,
          lineCap,
        };
    return this.addShape(group, {
      id: this.getElementId('track'),
      type: 'line',
      attrs,
    });
  }

  // 创建滑块的 shape
  private renderThumbShape(group: IGroup) {
    const { thumbOffset, thumbLen, theme = { default: {} } } = this.cfg;
    const { size, lineCap, thumbColor } = theme.default;
    const attrs = this.get('isHorizontal')
      ? {
          x1: thumbOffset + size / 2,
          y1: size / 2,
          x2: thumbOffset + thumbLen - size / 2,
          y2: size / 2,
          lineWidth: size,
          stroke: thumbColor,
          lineCap,
          cursor: 'default',
        }
      : {
          x1: size / 2,
          y1: thumbOffset + size / 2,
          x2: size / 2,
          y2: thumbOffset + thumbLen - size / 2,
          lineWidth: size,
          stroke: thumbColor,
          lineCap,
          cursor: 'default',
        };
    return this.addShape(group, {
      id: this.getElementId('thumb'),
      type: 'line',
      attrs,
    });
  }

  private bindEvents(group: IGroup, trackShape: IShape, thumbShape: IShape) {
    group.on('mousedown', this.onStartEvent(false));
    group.on('mouseup', this.onMouseUp);

    group.on('touchstart', this.onStartEvent(true));
    group.on('touchend', this.onMouseUp);

    trackShape.on('click', this.onTrackClick);
    thumbShape.on('mouseover', this.onThumbMouseOver);
    thumbShape.on('mouseout', this.onThumbMouseOut);
  }

  private onStartEvent = (isMobile: boolean) => (e: Event) => {
    this.isMobile = isMobile;
    e.originalEvent.preventDefault();
    const clientX = isMobile ? get(e.originalEvent, 'touches.0.clientX') : e.clientX;
    const clientY = isMobile ? get(e.originalEvent, 'touches.0.clientY') : e.clientY;

    // 将开始的点记录下来
    this.startPos = this.cfg.isHorizontal ? clientX : clientY;

    this.bindLaterEvent();
  };

  private bindLaterEvent = () => {
    const containerDOM = this.getContainerDOM();
    let events = [];

    if (this.isMobile) {
      events = [
        addEventListener(containerDOM, 'touchmove', this.onMouseMove),
        addEventListener(containerDOM, 'touchend', this.onMouseUp),
        addEventListener(containerDOM, 'touchcancel', this.onMouseUp),
      ];
    } else {
      events = [
        addEventListener(containerDOM, 'mousemove', this.onMouseMove),
        addEventListener(containerDOM, 'mouseup', this.onMouseUp),
        // 为了保证划出 canvas containerDom 时还没触发 mouseup
        addEventListener(containerDOM, 'mouseleave', this.onMouseUp),
      ];
    }
    this.clearEvents = () => {
      events.forEach((e) => {
        e.remove();
      });
    };
  };

  // 拖拽滑块的事件回调
  // 这里是 dom 原生事件，绑定在 dom 元素上的
  private onMouseMove = (e: MouseEvent) => {
    const { isHorizontal, thumbOffset } = this.cfg;
    e.preventDefault();
    const clientX = this.isMobile ? get(e, 'touches.0.clientX') : e.clientX;
    const clientY = this.isMobile ? get(e, 'touches.0.clientY') : e.clientY;
    // 鼠标松开的位置
    const endPos = isHorizontal ? clientX : clientY;
    // 滑块需要移动的距离, 由于这里是对滑块监听，所以移动的距离就是 diffDis, 如果监听对象是 container dom，则需要算比例
    const diff = endPos - this.startPos;
    // 更新 _startPos
    this.startPos = endPos;

    this.updateThumbOffset(thumbOffset + diff);
  };

  private onMouseUp = (e: Event) => {
    e.preventDefault();
    this.clearEvents();
  };

  // 点击滑道的事件回调,移动滑块位置
  private onTrackClick = (e: Event) => {
    const { isHorizontal, x, y, thumbLen } = this.cfg;
    const containerDOM = this.getContainerDOM();
    const rect = containerDOM.getBoundingClientRect();
    const { clientX, clientY } = e;
    const offset = isHorizontal ? clientX - rect.left - x - thumbLen / 2 : clientY - rect.top - y - thumbLen / 2;

    const newOffset = this.validateRange(offset);
    this.updateThumbOffset(newOffset);
  };

  private onThumbMouseOver = () => {
    const { thumbColor } = this.cfg.theme.hover;
    this.getElementByLocalId('thumb').attr('stroke', thumbColor);
    this.draw();
  };

  private onThumbMouseOut = () => {
    const { thumbColor } = this.cfg.theme.default;
    this.getElementByLocalId('thumb').attr('stroke', thumbColor);
    this.draw();
  };

  private getContainerDOM() {
    const container = this.get('container');
    const canvas = container && container.get('canvas');

    return canvas && canvas.get('container');
  }

  private validateRange(offset: number) {
    const { thumbLen, trackLen } = this.cfg;
    let newOffset = offset;
    if (offset + thumbLen > trackLen) {
      newOffset = trackLen - thumbLen;
    } else if (offset + thumbLen < thumbLen) {
      newOffset = 0;
    }
    return newOffset;
  }

  private draw() {
    const container = this.get('container');
    const canvas = container && container.get('canvas');

    if (canvas) {
      canvas.draw();
    }
  }

  private updateThumbOffset(offset: number) {
    const { thumbOffset, isHorizontal, thumbLen, size } = this.cfg;
    const newOffset = this.validateRange(offset);
    if (newOffset === thumbOffset) {
      // 如果更新后的 offset 与原值相同，则不改变
      return;
    }
    const thumbShape = this.getElementByLocalId('thumb');

    if (isHorizontal) {
      thumbShape.attr({
        x1: newOffset + size / 2,
        x2: newOffset + thumbLen - size / 2,
      });
    } else {
      thumbShape.attr({
        y1: newOffset + size / 2,
        y2: newOffset + thumbLen - size / 2,
      });
    }
    this.emitOffsetChange(newOffset);
  }

  private emitOffsetChange(offset: number) {
    const { thumbOffset: originalValue, trackLen, thumbLen } = this.cfg;
    this.cfg.thumbOffset = offset;
    // 发送事件
    this.emit('scrollchange', {
      thumbOffset: offset,
      ratio: clamp(offset / (trackLen - thumbLen), 0, 1),
    });
    this.delegateEmit('valuechange', {
      originalValue,
      value: offset,
    });
  }
}
