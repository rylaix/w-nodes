import { BaseNode } from "../lib/BaseNode";
import { AudioPort } from "../ports/AudioPort";
import { Canvas } from "$components/canvas";
import { Range } from "../lib/Range";
import { Select } from "../lib/Select";
import { Toggle } from "../lib/Toggle";
import { SignalNode } from "../lib/signalNode";
import { ctx } from "../ctx";
import { dispose } from "$library/dispose";
import { group } from "../_groups";
import { name } from "$library/function";
import { pipe } from "../lib/pipe";
import { signal } from "@preact/signals-react";
import { store } from "$components/node-editor";

const waveModes = [
  { value: 0, label: "Analog Clip" },
  { value: 1, label: "Soft Clip" },
  { value: 2, label: "Hard Clip" },
  { value: 3, label: "Rectifier" },
  { value: 4, label: "Sine Fold" },
  { value: 5, label: "Wave Shaping" },
];

@name("Saturator")
@group("custom")
export default class extends BaseNode {
  // Audio nodes
  #inputGain = ctx.createGain();
  #shaper = new WaveShaperNode(ctx, { oversample: "4x" });
  #outputGain = ctx.createGain();
  #wetGain = ctx.createGain();
  #dryGain = ctx.createGain();
  #merger = ctx.createGain();

  // Parameters
  @store _drive = new SignalNode(this.#inputGain.gain, { min: 0, max: 24 });
  @store _output = new SignalNode(this.#outputGain.gain, { min: 0, max: 2 });
  @store _dryWet = new SignalNode(this.#wetGain.gain, { min: 0, max: 1 });
  @store _softClip = new SignalNode(0, { default: 0 }); // Use SignalNode instead of signal
  @store _mode = signal(0);

  _connect = () => {
    this.#updateCurve();

    return dispose(
      pipe(this.#inputGain, this.#shaper),
      pipe(this.#shaper, this.#wetGain),
      pipe(this.#inputGain, this.#dryGain),
      pipe(this.#wetGain, this.#merger),
      pipe(this.#dryGain, this.#merger),
      pipe(this.#merger, this.#outputGain)
    );
  };

  // Update the curve based on the selected mode
  #updateCurve = () => {
    const mode = this._mode.value;
    let curve;
    switch (mode) {
      case 0: // Analog Clip
        curve = this.#createAnalogClipCurve(this._drive.value);
        break;
      case 1: // Soft Clip
        curve = this.#createSoftClipCurve();
        break;
      case 2: // Hard Clip
        curve = this.#createHardClipCurve();
        break;
      case 3: // Rectifier
        curve = this.#createRectifierCurve();
        break;
      case 4: // Sine Fold
        curve = this.#createSineFoldCurve();
        break;
      case 5: // Wave Shaping
        curve = this.#createWaveShapingCurve();
        break;
      default:
        curve = this.#createAnalogClipCurve(this._drive.value);
    }
    this.#shaper.curve = curve;
  };

  // Curve Generators
  #createAnalogClipCurve = (drive: number) => {
    const curve = new Float32Array(44100);
    const k = Math.pow(10, drive / 20);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / curve.length) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  };

  #createSoftClipCurve = () => {
    const curve = new Float32Array(44100);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / curve.length) * 2 - 1;
      curve[i] = x / (1 + Math.abs(x));
    }
    return curve;
  };

  #createHardClipCurve = () => {
    const curve = new Float32Array(44100);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / curve.length) * 2 - 1;
      curve[i] = Math.max(-1, Math.min(1, x));
    }
    return curve;
  };

  #createRectifierCurve = () => {
    const curve = new Float32Array(44100);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / curve.length) * 2 - 1;
      curve[i] = Math.abs(x);
    }
    return curve;
  };

  #createSineFoldCurve = () => {
    const curve = new Float32Array(44100);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / curve.length) * 2 - 1;
      curve[i] = Math.sin(x);
    }
    return curve;
  };

  #createWaveShapingCurve = () => {
    const curve = new Float32Array(44100);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / curve.length) * 2 - 1;
      curve[i] = x * x * Math.sign(x);
    }
    return curve;
  };

  input = <AudioPort value={this.#inputGain} />;
  output = <AudioPort value={this.#outputGain} output />;

  _view = () => (
    <>
      <Canvas
        width={300}
        height={100}
        draw={(ctx, can) => {
          const width = can.width;
          const height = can.height;

          ctx.clearRect(0, 0, width, height);

          const curve = this.#shaper.curve;
          if (!curve) return;

          ctx.beginPath();
          ctx.moveTo(0, height / 2);

          for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * width;
            const y = height / 2 - curve[i] * (height / 2);
            ctx.lineTo(x, y);
          }

          ctx.strokeStyle = "#FFF";
          ctx.lineWidth = 2;
          ctx.stroke();
        }}
      />

      <Select
        label="Waveform Mode"
        variants={waveModes}
        value={this._mode}
        change={(v) => {
          this._mode.value = +v;
          this.#updateCurve();
        }}
      />

      <Range label="Drive" value={this._drive} postfix="dB" accuracy={2} />
      <Range label="Output" value={this._output} postfix="x" accuracy={2} />
      <Range label="Dry/Wet" value={this._dryWet} postfix="%" accuracy={1} />
      <Toggle label="Soft Clip" value={this._softClip} />
    </>
  );
}
