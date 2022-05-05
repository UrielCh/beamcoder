import beamcoder, { demuxerStream } from '..'; // Use require('beamcoder') externally
import path from 'path';
import fs from 'fs';
import { Demuxer } from '../ts/types/Demuxer';

async function getFiles(): Promise<string[]> {
    // https://github.com/awslabs/amazon-kinesis-video-streams-producer-c/raw/master/samples/h264SampleFrames/frame-001.h264
    const src = path.join(__dirname, 'capture', 'h264SampleFrames');
    const filelist = await fs.promises.readdir(src);
    filelist.sort();
    return filelist.map(f => path.join(src, f));
}

async function run() {
    const stream = new demuxerStream({ highwaterMark: 3600 });

    const demuxPromise = stream.demuxer({})
    demuxPromise.then(async (demuxer: Demuxer) => {
        const packet = await demuxer.read();
        let dec = beamcoder.decoder({ demuxer, stream_index: 0 }); // Create a decoder
        let decResult = await dec.decode(packet); // Decode the frame
        if (decResult.frames.length === 0) // Frame may be buffered, so flush it out
            decResult = await dec.flush();
        // Filtering could be used to transform the picture here, e.g. scaling
        let enc = beamcoder.encoder({ // Create an encoder for JPEG data
            name: 'mjpeg', // FFmpeg does not have an encoder called 'jpeg'
            width: dec.width,
            height: dec.height,
            pix_fmt: dec.pix_fmt.indexOf('422') >= 0 ? 'yuvj422p' : 'yuvj420p',
            time_base: [1, 1]
        });
        let jpegResult = await enc.encode(decResult.frames[0]); // Encode the frame
        await enc.flush(); // Tidy the encoder
        fs.writeFileSync('capture.jpg', jpegResult.packets[0].data);
        console.log(demuxer.streams.length);
        demuxer.forceClose();
    });
    // https://github.com/awslabs/amazon-kinesis-video-streams-producer-c/raw/master/samples/h264SampleFrames/frame-001.h264
    const filelist = await getFiles();
    for (const fullname of filelist) {
        const buf = await fs.promises.readFile(fullname);
        stream.write(buf);
    }
    console.log('all frame pushed')
    stream.emit('finish')
    console.log('end resolved');;
}

run();
