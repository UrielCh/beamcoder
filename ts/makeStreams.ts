/*
  Aerostat Beam Coder - Node.js native bindings to FFmpeg
  Copyright (C) 2019 Streampunk Media Ltd.

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.

  https://www.streampunk.media/ mailto:furnace@streampunk.media
  14 Ormiscaig, Aultbea, Achnasheen, IV22 2JJ  U.K.
*/

import beamcoder from './beamcoder'
import { BeamstreamParams } from './types';
import serialBalancer from './serialBalancer';
import runStreams from './runStreams';

export default async function makeStreams(params: BeamstreamParams): Promise<{ run(): Promise<void>} > {
  params.video.forEach(p => {
    p.sources.forEach((src: any) =>
      src.decoder = beamcoder.decoder({ demuxer: src.format, stream_index: src.streamIndex }));
  });
  params.audio.forEach(p => {
    p.sources.forEach((src: any) =>
      src.decoder = beamcoder.decoder({ demuxer: src.format, stream_index: src.streamIndex }));
  });

  params.video.forEach((p: any) => {
    p.filter = beamcoder.filterer({
      filterType: 'video',
      inputParams: p.sources.map((src, i) => {
        const stream = src.format.streams[src.streamIndex];
        return {
          name: `in${i}:v`,
          width: stream.codecpar.width,
          height: stream.codecpar.height,
          pixelFormat: stream.codecpar.format,
          timeBase: stream.time_base,
          pixelAspect: stream.sample_aspect_ratio };
      }),
      outputParams: p.streams.map((str, i) => { return { name: `out${i}:v`, pixelFormat: str.codecpar.format }; }),
      filterSpec: p.filterSpec });
  });
  const vidFilts = await Promise.all(params.video.map((p: any) => p.filter));
  params.video.forEach((p: any, i) => p.filter = vidFilts[i]);
  // params.video.forEach(p => console.log(p.filter.graph.dump()));

  params.audio.forEach((p: any) => {
    p.filter = beamcoder.filterer({
      filterType: 'audio',
      inputParams: p.sources.map((src, i) => {
        const stream = src.format.streams[src.streamIndex];
        return {
          name: `in${i}:a`,
          sampleRate: src.decoder.sample_rate,
          sampleFormat: src.decoder.sample_fmt,
          channelLayout: src.decoder.channel_layout,
          timeBase: stream.time_base };
      }),
      outputParams: p.streams.map((str, i) => { 
        return { 
          name: `out${i}:a`,
          sampleRate: str.codecpar.sample_rate,
          sampleFormat: str.codecpar.format,
          channelLayout: str.codecpar.channel_layout }; }),
      filterSpec: p.filterSpec });
  });
  const audFilts = await Promise.all(params.audio.map((p: any) => p.filter));
  params.audio.forEach((p: any, i) => p.filter = audFilts[i]);
  // params.audio.forEach(p => console.log(p.filter.graph.dump()));

  let mux;
  if (params.out.output_stream) {
    let muxerStream = beamcoder.muxerStream({ highwaterMark: 1024 });
    muxerStream.pipe(params.out.output_stream);
    mux = muxerStream.muxer({ format_name: params.out.formatName });
  } else
    mux = beamcoder.muxer({ format_name: params.out.formatName });

  params.video.forEach((p: any) => {
    p.streams.forEach((str, i) => {
      const encParams = p.filter.graph.filters.find(f => f.name === `out${i}:v`).inputs[0];
      str.encoder = beamcoder.encoder({
        name: str.name,
        width: encParams.w,
        height: encParams.h,
        pix_fmt: encParams.format,
        sample_aspect_ratio: encParams.sample_aspect_ratio,
        time_base: encParams.time_base,
        // framerate: [encParams.time_base[1], encParams.time_base[0]],
        // bit_rate: 2000000,
        // gop_size: 10,
        // max_b_frames: 1,
        // priv_data: { preset: 'slow' }
        priv_data: { crf: 23 } }); // ... more required ...
    });
  });

  params.audio.forEach((p: any) => {
    p.streams.forEach((str: any, i) => {
      const encParams = p.filter.graph.filters.find(f => f.name === `out${i}:a`).inputs[0];
      str.encoder = beamcoder.encoder({
        name: str.name,
        sample_fmt: encParams.format,
        sample_rate: encParams.sample_rate,
        channel_layout: encParams.channel_layout,
        flags: { GLOBAL_HEADER: mux.oformat.flags.GLOBALHEADER } });
      
      str.codecpar.frame_size = str.encoder.frame_size;
    });
  });

  params.video.forEach(p => {
    p.streams.forEach((str: any) => {
      str.stream = mux.newStream({ 
        name: str.name,
        time_base: str.time_base,
        interleaved: true }); // Set to false for manual interleaving, true for automatic
      Object.assign(str.stream.codecpar, str.codecpar);
    });
  });

  params.audio.forEach(p => {
    p.streams.forEach((str: any) => {
      str.stream = mux.newStream({
        name: str.name,
        time_base: str.time_base,
        interleaved: true }); // Set to false for manual interleaving, true for automatic
      Object.assign(str.stream.codecpar, str.codecpar);
    });
  });

  return {
    run: async () => {
      await mux.openIO({
        url: params.out.url ? params.out.url : '',
        flags: params.out.flags ? params.out.flags : {}
      });
      await mux.writeHeader({ options: params.out.options ? params.out.options : {} });

      const muxBalancer = new serialBalancer(mux.streams.length);
      const muxStreamPromises = [];
      params.video.forEach((p: any) => muxStreamPromises.push(runStreams('video', p.sources, p.filter, p.streams, mux, muxBalancer)));
      params.audio.forEach((p: any) => muxStreamPromises.push(runStreams('audio', p.sources, p.filter, p.streams, mux, muxBalancer)));
      await Promise.all(muxStreamPromises);

      await mux.writeTrailer();
    }
  };
}
