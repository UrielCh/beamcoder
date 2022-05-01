const test = require('tape');
const beamcoder = require('../ts');
const md5File = require('md5-file');


test('recompress mp4', async t => {
  async function run() {
    const src = '../Media/big_buck_bunny_1080p_h264.mov';
    const sumSrc = await md5File(src);

    t.equal(sumSrc, 'c23ab2ff12023c684f46fcc02c57b585', 'source File have incrrrect md5sum');

    const urls = [`file:${src}`];
    const spec = {
      start: 0,
      end: 24
    };

    const params = {
      video: [{
        sources: [{
          url: urls[0],
          ms: spec,
          streamIndex: 0
        }],
        filterSpec: '[in0:v] scale=1280:720, colorspace=all=bt709 [out0:v]',
        streams: [{
          name: 'h264',
          time_base: [1, 90000],
          codecpar: {
            width: 1280,
            height: 720,
            format: 'yuv422p',
            color_space: 'bt709',
            sample_aspect_ratio: [1, 1]
          }
        }]
      }],
      audio: [{
        sources: [{
          url: urls[0],
          ms: spec,
          streamIndex: 2
        }],
        filterSpec: '[in0:a] aformat=sample_fmts=fltp:channel_layouts=mono [out0:a]',
        streams: [{
          name: 'aac',
          time_base: [1, 90000],
          codecpar: {
            sample_rate: 48000,
            format: 'fltp',
            frame_size: 1024,
            channels: 1,
            channel_layout: 'mono'
          }
        }]
      }, ],
      out: {
        formatName: 'mp4',
        url: 'file:temp.mp4'
      }
    };

    await beamcoder.makeSources(params);
    const beamStreams = await beamcoder.makeStreams(params);

    await beamStreams.run();

    const sumDest = await md5File('temp.mp4');

    t.equal(sumDest, 'f08742dd1982073c2eb01ba6faf86d63', 'dest File have incorrect md5sum');
  }

  console.log('Running mp4 maker');
  return run();
  // .then(() => console.log(`Finished ${Date.now() - start}ms`))
  //.catch(console.error);
});
