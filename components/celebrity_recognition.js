console.log('IMPORTING CELEBRITY RECOGNITION')

// define style rules to be programtically loaded
var style = document.createElement('style');
style.innerHTML = `


`;
document.getElementsByTagName('head')[0].appendChild(style);


// define component
Vue.component('celebrity-recognition-viz', {
    props: ['json_data', 'video_info'],
    data: function () {
        return {
            confidence_threshold: 0.5,
            interval_timer: null,
            ctx: null
        }
    },
    computed: {
        celebrity_tracks: function () {
            `
            Extract just the celebrity tracking data from json
            `

            if (!this.json_data.annotation_results)
                return []

            for (let index = 0; index < this.json_data.annotation_results.length; index++) {
                if ('celebrity_recognition_annotations' in this.json_data.annotation_results[index])
                    return this.json_data.annotation_results[index].celebrity_recognition_annotations
            }
            return []
        },

        indexed_celebrity_tracks: function () {
            `
            Create a clean list of celebrity tracking data with realisied nullable fields 
            and scaled bounding boxes ready to be drawn by the canvas
            `

            const indexed_tracks = []


            this.celebrity_tracks.forEach(element => {
                const detected_celebrity = new Celebrity_Detected(element, this.video_info.height, this.video_info.width, this.confidence_threshold)
                if (detected_celebrity.segments.length > 0)
                    indexed_tracks.push(detected_celebrity)
            })

            return indexed_tracks
        },

        object_track_segments: function () {
            ` 
            create the list of cronological time segments that represent just when objects are present on screen
            `
            const segments = {}

            this.indexed_celebrity_tracks.forEach(object_tracks => {

                if (!(object_tracks.name in segments))
                    segments[object_tracks.name] = { 'segments': [], 'count': 0 }


                object_tracks.segments.forEach(celebrity_segemnt => {


                    segments[object_tracks.name].count++

                    var added = false

                    for (let index = 0; index < segments[object_tracks.name].length; index++) {

                        const segment = segments[object_tracks.name].segments[index]
                        if (celebrity_segemnt.start_time < segment[1]) {
                            segments[object_tracks.name].segments[index][1] = Math.max(segments[object_tracks.name].segments[index][1], celebrity_segemnt.end_time)
                            added = true
                            break
                        }
                    }

                    if (!added)
                        segments[object_tracks.name].segments.push([celebrity_segemnt.start_time, celebrity_segemnt.end_time])



                })

            })

            return segments
        }
    },
    methods: {
        segment_style: function (segment) {
            return {
                left: ((segment[0] / this.video_info.length) * 100).toString() + '%',
                width: (((segment[1] - segment[0]) / this.video_info.length) * 100).toString() + '%'
            }
        },
        segment_clicked: function (segment_data) {
            this.$emit('segment-clicked', { seconds: segment_data[0] - 0.5 })
        }
    },
    template: `
    <div calss="object-tracking-container">

        <div class="confidence">
            <span>Confidence threshold</span>
            <input type="range" min="0.0" max="1" value="0.5" step="0.01" v-model="confidence_threshold">
            <span class="confidence-value">{{confidence_threshold}}</span>
        </div>

        <div class="data-warning" v-if="celebrity_tracks.length == 0"> No celebrity detection data in JSON</div>

        <transition-group name="segments" tag="div">
            
            <div class="segment-container" v-for="segments, key in object_track_segments" v-bind:key="key + 'z'">
                <div class="label">{{key}} ({{segments.count}})</div>
                <div class="segment-timeline">
                    <div class="segment" v-for="segment in segments.segments" 
                                        v-bind:style="segment_style(segment)" 
                                        v-on:click="segment_clicked(segment)"
                    ></div>
                </div>
            </div>
        </transition-group>
    </div>
    `,
    mounted: function () {
        console.log('mounted component')
        var canvas = document.getElementById("my_canvas")
        this.ctx = canvas.getContext("2d")
        this.ctx.font = "20px Roboto"
        const ctx = this.ctx

        const component = this

        this.interval_timer = setInterval(function () {
            console.log('running')
            const object_tracks = component.indexed_celebrity_tracks

            draw_bounding_boxes(object_tracks, ctx)
        }, 1000 / 30)
    },
    beforeDestroy: function () {
        console.log('destroying component')
        clearInterval(this.interval_timer)
        this.ctx.clearRect(0, 0, 800, 500)
    }
})



class Celebrity_Frame {

    constructor(json_data, video_height, video_width) {

        this.time_offset = nullable_time_offset_to_seconds(json_data.time_offset)

        this.box = {
            'x': (json_data.normalized_bounding_box.left || 0) * video_width,
            'y': (json_data.normalized_bounding_box.top || 0) * video_height,
            'width': ((json_data.normalized_bounding_box.right || 0) - (json_data.normalized_bounding_box.left || 0)) * video_width,
            'height': ((json_data.normalized_bounding_box.bottom || 0) - (json_data.normalized_bounding_box.top || 0)) * video_height
        }
    }
}



class Celebrity_Track {
    constructor(json_data, video_height, video_width) {

        this.start_time = nullable_time_offset_to_seconds(json_data.segment.start_time_offset)
        this.end_time = nullable_time_offset_to_seconds(json_data.segment.end_time_offset)
        this.confidence = json_data.confidence

        this.frames = []

        json_data.timestamped_objects.forEach(frame => {
            this.frames.push(new Celebrity_Frame(frame, video_height, video_width))
        })
    }

    has_frames_for_time(seconds) {
        return ((this.start_time <= seconds) && (this.end_time >= seconds))
    }

    most_recent_real_bounding_box(seconds) {

        for (let index = 0; index < this.frames.length; index++) {
            if (this.frames[index].time_offset > seconds) {
                if (index > 0)
                    return this.frames[index - 1].box
                else
                    return null
            }
        }
        return null
    }

    most_recent_interpolated_bounding_box(seconds) {

        for (let index = 0; index < this.frames.length; index++) {
            if (this.frames[index].time_offset > seconds) {
                if (index > 0) {
                    if ((index == 1) || (index == this.frames.length - 1))
                        return this.frames[index - 1].box

                    // create a new interpolated box between the 
                    const start_box = this.frames[index - 1]
                    const end_box = this.frames[index]
                    const time_delt_ratio = (seconds - start_box.time_offset) / (end_box.time_offset - start_box.time_offset)

                    const interpolated_box = {
                        'x': start_box.box.x + (end_box.box.x - start_box.box.x) * time_delt_ratio,
                        'y': start_box.box.y + (end_box.box.y - start_box.box.y) * time_delt_ratio,
                        'width': start_box.box.width + (end_box.box.width - start_box.box.width) * time_delt_ratio,
                        'height': start_box.box.height + (end_box.box.height - start_box.box.height) * time_delt_ratio
                    }
                    return interpolated_box

                } else
                    return null
            }
        }
        return null
    }

    current_bounding_box(seconds, interpolate = true) {

        if (interpolate)
            return this.most_recent_interpolated_bounding_box(seconds)
        else
            return this.most_recent_real_bounding_box(seconds)
    }
}


class Celebrity_Detected {
    constructor(json_data, video_height, video_width, confidence_threshold) {

        this.name = json_data.entity.description
        this.id = json_data.entity.entity_id

        this.segments = []

        json_data.tracks.forEach(track => {
            if (track.confidence > confidence_threshold)
                this.segments.push(new Celebrity_Track(track, video_height, video_width))
        })
    }

    has_frames_for_time(seconds) {

        for (let index = 0; index < this.segments.length; index++) {
            if (this.segments[index].has_frames_for_time(seconds))
                return true
        }
        return false
    }

    current_bounding_box(seconds, interpolate = true) {

        for (let index = 0; index < this.segments.length; index++) {
            if (this.segments[index].has_frames_for_time(seconds))
                return this.segments[index].current_bounding_box(seconds, interpolate)
        }
        return null
    }
}