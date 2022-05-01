
import beamcoder from './beamcoder'
import { BeamstreamParams } from './types';
import readStream from './readStream';


export default async function makeSources(params: BeamstreamParams): Promise<void> {
    if (!params.video) params.video = [];
    if (!params.audio) params.audio = [];
  
    params.video.forEach(p => p.sources.forEach((src: any) => {
      if (src.input_stream) {
        const demuxerStream = beamcoder.demuxerStream({ highwaterMark: 1024 });
        src.input_stream.pipe(demuxerStream);
        src.format = demuxerStream.demuxer({ iformat: src.iformat, options: src.options });
      } else
        src.format = beamcoder.demuxer({ url: src.url, iformat: src.iformat, options: src.options });
    }));
    params.audio.forEach(p => p.sources.forEach((src: any) => {
      if (src.input_stream) {
        const demuxerStream = beamcoder.demuxerStream({ highwaterMark: 1024 });
        src.input_stream.pipe(demuxerStream);
        src.format = demuxerStream.demuxer({ iformat: src.iformat, options: src.options });
      } else
        src.format = beamcoder.demuxer({ url: src.url, iformat: src.iformat, options: src.options });
    }));
  
    await params.video.reduce(async (promise, p) => {
      await promise;
      return p.sources.reduce(async (promise, src: any) => {
        await promise;
        src.format = await src.format;
        if (src.ms && !src.input_stream)
          src.format.seek({ time: src.ms.start });
        return src.format;
      }, Promise.resolve());
    }, Promise.resolve());
    await params.audio.reduce(async (promise, p) => {
      await promise;
      return p.sources.reduce(async (promise, src: any) => {
        await promise;
        src.format = await src.format;
        if (src.ms && !src.input_stream)
          src.format.seek({ time: src.ms.start });
        return src.format;
      }, Promise.resolve());
    }, Promise.resolve());
  
    params.video.forEach(p => p.sources.forEach((src: any) => 
      src.stream = readStream({ highWaterMark : 1 }, src.format, src.ms, src.streamIndex)));
    params.audio.forEach(p => p.sources.forEach((src: any) => 
      src.stream = readStream({ highWaterMark : 1 }, src.format, src.ms, src.streamIndex)));
  }
  