/*
  Aerostat Beam Coder - Node.js native bindings to FFmpeg
  Copyright (C) 2019 Streampunk Media Ltd.
  Copyright (C) 2022 Chemouni Uriel.
  
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

// TODO Convert to class
// TODO Convert to class
// TODO Convert to class
// TODO Convert to class

import { EncodedPackets, Packet } from "./types";

export default function serialBalancer(numStreams: number) {
    let pending = [] as { ts: number, streamIndex: number, resolve?: (result: any) => void, pkt?: Packet | null }[];
    // initialise with negative ts and no pkt
    // - there should be no output until each stream has sent its first packet
    for (let s = 0; s < numStreams; ++s)
      pending.push({ ts: -Number.MAX_VALUE, streamIndex: s });
  
    const adjustTS = (pkt:{ pts: number, dts: number, duration: number }, srcTB: [number, number], dstTB: [number, number]) => {
      const adj = (srcTB[0] * dstTB[1]) / (srcTB[1] * dstTB[0]);
      pkt.pts = Math.round(pkt.pts * adj);
      pkt.dts = Math.round(pkt.dts * adj);
      pkt.duration > 0 ? Math.round(pkt.duration * adj) : Math.round(adj);
    };
      
    const pullPkts = (pkt: null | Packet, streamIndex: number, ts: number): Promise<void | Packet> => {
      return new Promise(resolve => {
        Object.assign(pending[streamIndex], { pkt: pkt, ts: ts, resolve: resolve });
        const minTS = pending.reduce((acc, pend) => Math.min(acc, pend.ts), Number.MAX_VALUE);
        // console.log(streamIndex, pending.map(p => p.ts), minTS);
        const nextPend = pending.find(pend => pend.pkt && (pend.ts === minTS));
        if (nextPend) nextPend.resolve(nextPend.pkt);
        if (!pkt) resolve(undefined);
      });
    };
  
    this.writePkts = (
        packets: EncodedPackets | null,
        srcStream: { time_base: [number, number] },
        dstStream: {
            time_base: [number, number],
            index: number
        },
        writeFn: (r: Packet) => void,
        final = false): Promise<void | Packet> => {
      if (packets && packets.packets.length) {
        return packets.packets.reduce(async (promise, pkt) => {
          await promise;
          pkt.stream_index = dstStream.index;
          adjustTS(pkt, srcStream.time_base, dstStream.time_base);
          const pktTS = pkt.pts * dstStream.time_base[0] / dstStream.time_base[1];
          return writeFn(await pullPkts(pkt, dstStream.index, pktTS) as Packet);
        }, Promise.resolve());
      } else if (final)
        return pullPkts(null, dstStream.index, Number.MAX_VALUE);
    };
  }
  