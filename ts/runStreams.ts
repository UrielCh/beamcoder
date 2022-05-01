import frameDicer from "./frameDicer";
import parallelBalancer from "./parallelBalancer";
import teeBalancer from "./teeBalancer";
import transformStream from "./transformStream";
import writeStream from "./writeStream";

export function runStreams(streamType, sources, filterer, streams, mux, muxBalancer) {
    return new Promise((resolve, reject) => {
      if (!sources.length)
        return resolve(undefined);
  
      const timeBaseStream = sources[0].format.streams[sources[0].streamIndex];
      const filterBalancer = parallelBalancer({ name: 'filterBalance', highWaterMark : 1 }, streamType, sources.length);
  
      sources.forEach((src, srcIndex) => {
        const decStream = transformStream({ name: 'decode', highWaterMark : 1 },
          pkts => src.decoder.decode(pkts), () => src.decoder.flush(), reject);
        const filterSource = writeStream({ name: 'filterSource', highWaterMark : 1 },
          pkts => (filterBalancer as any).pushPkts(pkts, src.format.streams[src.streamIndex], srcIndex),
          () => (filterBalancer as any).pushPkts(null, src.format.streams[src.streamIndex], srcIndex, true), reject);
  
        src.stream.pipe(decStream).pipe(filterSource);
      });
  
      const streamTee = teeBalancer({ name: 'streamTee', highWaterMark : 1 }, streams.length);
      const filtStream = transformStream({ name: 'filter', highWaterMark : 1 }, frms => {
        if (filterer.cb) filterer.cb(frms[0].frames[0].pts);
        return filterer.filter(frms);
      }, () => {}, reject);
      const streamSource = writeStream({ name: 'streamSource', highWaterMark : 1 },
        frms => (streamTee as any).pushFrames(frms), () => (streamTee as any).pushFrames([], true), reject);
  
      filterBalancer.pipe(filtStream).pipe(streamSource);
  
      streams.forEach((str, i) => {
        const dicer: any = new frameDicer(str.encoder, 'audio' === streamType);
        const diceStream = transformStream({ name: 'dice', highWaterMark : 1 },
          frms => dicer.dice(frms), () => dicer.dice([], true), reject);
        const encStream = transformStream({ name: 'encode', highWaterMark : 1 },
          frms => str.encoder.encode(frms), () => str.encoder.flush(), reject);
        const muxStream = writeStream({ name: 'mux', highWaterMark : 1 },
          pkts => muxBalancer.writePkts(pkts, timeBaseStream, str.stream, pkts => mux.writeFrame(pkts)),
          () => muxBalancer.writePkts(null, timeBaseStream, str.stream, pkts => mux.writeFrame(pkts), true), reject);
        muxStream.on('finish', resolve);
  
        streamTee[i].pipe(diceStream).pipe(encStream).pipe(muxStream);
      });
    });
  }