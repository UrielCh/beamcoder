import { Demuxer, DemuxerCreateOptions } from "./Demuxer"
import { Muxer, MuxerCreateOptions } from "./Muxer"
import { InputFormat } from "./FormatContext"

/**
 * WritableDemuxerStream is not a Writable Class augmented by a demuxer function, should be replace by a new class
 * A [Node.js Writable stream](https://nodejs.org/docs/latest-v12.x/api/stream.html#stream_writable_streams)
 * allowing source data to be streamed to the demuxer from a file or other stream source such as a network connection
 */
 export type WritableDemuxerStream = Writable & {
	/**
	 * Create a demuxer for this source
	 * @param options a DemuxerCreateOptions object
     * @returns a promise that resolves to a Demuxer when it has determined sufficient
	 * format details by consuming data from the source. The promise will wait indefinitely 
	 * until sufficient source data has been read.
	 */
	 demuxer: (options?: { iformat?: InputFormat, options?: { [key: string]: any }, governor?: Governor }) => Promise<Demuxer>
};

/**
 * Create a WritableDemuxerStream to allow streaming to a Demuxer
 * @param options.highwaterMark Buffer level when `stream.write()` starts returng false.
 * @returns A WritableDemuxerStream that can be streamed to.
 */
export function demuxerStream(params: { highwaterMark?: number }): WritableDemuxerStream

/**
 * A [Node.js Readable stream](https://nodejs.org/docs/latest-v12.x/api/stream.html#stream_readable_streams)
 * allowing data to be streamed from the muxer to a file or other stream destination such as a network connection
 */
 export type ReadableMuxerStream = Readable & {
	/**
	 * Create a demuxer for this source
	 * @param options a DemuxerCreateOptions object
     * @returns a promise that resolves to a Demuxer when it has determined sufficient
	 * format details by consuming data from the source. The promise will wait indefinitely 
	 * until sufficient source data has been read.
	 */
	 muxer: (options?: MuxerCreateOptions & {governor?: Governor }) => Muxer
};
/**
 * Create a ReadableMuxerStream to allow streaming from a Muxer
 * @param options.highwaterMark The maximum number of bytes to store in the internal buffer before ceasing to read from the underlying resource.
 * @returns A ReadableMuxerStream that can be streamed from.
 */
export function muxerStream(params: { highwaterMark?: number }): ReadableMuxerStream

/** Create object for AVIOContext based buffered I/O */
// export function governor(options: { highWaterMark: number }): {
//   read(len: number): Promise<Buffer>
//   write(data: Buffer): Promise<null>
//   finish(): undefined
// }

/** Source definition for a beamstream channel, from either a file or NodeJS ReadableStream */
export interface BeamstreamSource {
	url?: string
	input_stream?: NodeJS.ReadableStream
	ms?: { start: number, end: number }
	streamIndex?: number
	iformat?: InputFormat
    options?: { [key: string]: any }

	format?: Demuxer; // filled by makeSources
	stream?: Readable; // filled by makeSources
	decoder?: Decoder; // FIXME
}
/** Codec definition for the destination channel */
export interface BeamstreamStream {
	name: string
	time_base: Array<number>
	codecpar: { [key: string]: any }

	encoder?: Encoder; 	// filled by runStreams
	stream?: Stream;	// filled by runStreams

}
/** Definition for a channel of beamstream processing */
export interface BeamstreamChannel {
	sources: Array<BeamstreamSource>
	filterSpec: string
	streams: Array<BeamstreamStream>
	filter?: Filterer; // filled by makeStreams
}
/**
 * Definition for a beamstream process consisting of a number of audio and video sources
 * that are to be processed and multiplexed into an output file or stream
 */
export interface BeamstreamParams {
	video?: Array<BeamstreamChannel>
	audio?: Array<BeamstreamChannel>
  /** Destination definition for the beamstream process, to either a file or NodeJS WritableStream */
  out: {
		formatName: string
		url?: string
		output_stream?: NodeJS.WritableStream
		flags?: {
			READ?: boolean
			WRITE?: boolean
			NONBLOCK?: boolean
			DIRECT?: boolean
		}
		options?: { [key:string]: any }
	}
}
/**
 * Initialise the sources for the beamstream process.
 * Note - the params object is updated by the function.
 */
export function makeSources(params: BeamstreamParams): Promise<void>
/**
 * Initialise the output streams for the beamstream process.
 * Note - the params object is updated by the function.
 * @returns Promise which resolves to an object with a run function that starts the processing
 */
export function makeStreams(params: BeamstreamParams): Promise<{ run(): Promise<void>} >

