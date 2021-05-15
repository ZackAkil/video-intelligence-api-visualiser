// define style rules to be programtically loaded
var style = document.createElement('style');
style.innerHTML = `



`;
document.getElementsByTagName('head')[0].appendChild(style);


// define component
Vue.component('text-detection-viz', {
    props: ['json_data', 'video_info'],
    data: function () {
        return {
            confidence_threshold: 0.5,
            interval_timer: null,
            ctx: null,
            frame_rate: 30
        }
    },
    computed: {
        text_tracks: function () {
            `
            Extract just the text detection data from json
            `

            if (!this.json_data.annotation_results)
                return []

            for (let index = 0; index < this.json_data.annotation_results.length; index++) {
                if ('text_annotations' in this.json_data.annotation_results[index])
                    return this.json_data.annotation_results[index].text_annotations
            }
            return []
        },

        indexed_text_tracks: function () {
            `
            Create a clean list of text detection data with realisied nullable fields 
            and scaled bounding boxes ready to be drawn by the canvas
            `

            const indexed_tracks = []

            if (!this.text_tracks)
                return []

            this.text_tracks.forEach(element => {
                // if (element.tracks[0].confidence > this.confidence_threshold)
                indexed_tracks.push(new Text_Detection(element, this.video_info.height, this.video_info.width))
            })

            return indexed_tracks
        },

        object_track_segments: function () {
            ` 
            create the list of cronological time segments that represent just when objects are present on screen
            `
            const segments = {}

            // const segments = { 'face': { 'segments': [], 'count': 0 } }

            // this.indexed_face_tracks.forEach(object_tracks => {

            //     segments['face'].count++

            //     var added = false

            //     for (let index = 0; index < segments['face'].length; index++) {

            //         const segment = segments['face'].segments[index]
            //         if (object_tracks.start_time < segment[1]) {
            //             segments['face'].segments[index][1] = Math.max(segments['face'].segments[index][1], object_tracks.end_time)
            //             added = true
            //             break
            //         }
            //     }

            //     if (!added)
            //         segments['face'].segments.push([object_tracks.start_time, object_tracks.end_time])
            // })

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
            this.$emit('segment-clicked', { seconds: segment_data[0] })
        }
    },
    template: `
    <div calss="object-tracking-container">

        <div class="confidence">
            <span>Confidence threshold</span>
            <input type="range" min="0.0" max="1" value="0.5" step="0.01" v-model="confidence_threshold">
            <span class="confidence-value">{{confidence_threshold}}</span>
        </div>

        <div class="data-warning" v-if="text_tracks.length == 0"> No face detection data in JSON</div>

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
            const object_tracks = component.indexed_text_tracks

            draw_bounding_polys(object_tracks, ctx)

        }, 1000 / this.frame_rate)
    },
    beforeDestroy: function () {
        console.log('destroying component')
        clearInterval(this.interval_timer)
        this.ctx.clearRect(0, 0, 800, 500)
    }
})


function draw_bounding_polys(object_tracks, ctx) {
    ctx.clearRect(0, 0, 800, 500)

    const current_time = video.currentTime

    object_tracks.forEach(tracked_object => {

        if (tracked_object.has_frames_for_time(current_time)) {
            draw_bounding_poly(tracked_object.current_bounding_box(current_time), tracked_object.text, ctx)
        }

    })
}

function draw_bounding_poly(poly, name = null, ctx) {
    ctx.strokeStyle = "#4285F4"
    ctx.beginPath()
    ctx.lineWidth = 3

    ctx.moveTo(poly[0].x, poly[0].y)
    poly.forEach(point => {
        ctx.lineTo(point.x, point.y)
    })
    ctx.lineTo(poly[0].x, poly[0].y)
    ctx.stroke()

    // if (name) {
    //     ctx.fillStyle = "#4285F4"
    //     ctx.fillRect(box.x, box.y, name.length * 13, 32)
    //     ctx.fillStyle = "#ffffff"
    //     ctx.fillText(name, box.x + 5, box.y + 22)
    // }
}




// class Face_Frame {
//     constructor(json_data, video_height, video_width) {

//         this.time_offset = nullable_time_offset_to_seconds(json_data.time_offset)

//         this.box = {
//             'x': (json_data.normalized_bounding_box.left || 0) * video_width,
//             'y': (json_data.normalized_bounding_box.top || 0) * video_height,
//             'width': ((json_data.normalized_bounding_box.right || 0) - (json_data.normalized_bounding_box.left || 0)) * video_width,
//             'height': ((json_data.normalized_bounding_box.bottom || 0) - (json_data.normalized_bounding_box.top || 0)) * video_height
//         }

//         // this.landmarks = {
//         //     nose: null, left_eye: null, right_eye: null, left_ear: null, right_ear: null, left_shoulder: null,
//         //     right_shoulder: null, left_elbow: null, right_elbow: null, left_wrist: null, right_wrist: null,
//         //     left_hip: null, right_hip: null, left_knee: null, right_knee: null, left_ankle: null, right_ankle: null
//         // }

//         // if (json_data.landmarks)
//         //     json_data.landmarks.forEach(landmark => {
//         //         this.landmarks[landmark.name] = { 'x': landmark.point.x * video_width, 'y': landmark.point.y * video_height }
//         //     })
//     }
// }

class Text_Frame {
    constructor(json_data, video_height, video_width) {

        this.time_offset = nullable_time_offset_to_seconds(json_data.time_offset)

        this.poly = []

        json_data.rotated_bounding_box.vertices.forEach(vertex => {
            this.poly.push({ x: vertex.x * video_width, y: vertex.y * video_height })
        })

        // this.box = {
        //     'x': (json_data.normalized_bounding_box.left || 0) * video_width,
        //     'y': (json_data.normalized_bounding_box.top || 0) * video_height,
        //     'width': ((json_data.normalized_bounding_box.right || 0) - (json_data.normalized_bounding_box.left || 0)) * video_width,
        //     'height': ((json_data.normalized_bounding_box.bottom || 0) - (json_data.normalized_bounding_box.top || 0)) * video_height
        // }

        // this.start_time = nullable_time_offset_to_seconds(json_data.segment.start_time_offset)
        // this.end_time = nullable_time_offset_to_seconds(json_data.segment.end_time_offset)
        // this.confidence = json_data.confidence

        // this.frames = []

        // json_data.frames.forEach(frame => {
        //     this.frames.push(new )
        // })

    }
}

class Text_Segment {
    constructor(json_data, video_height, video_width) {

        this.start_time = nullable_time_offset_to_seconds(json_data.segment.start_time_offset)
        this.end_time = nullable_time_offset_to_seconds(json_data.segment.end_time_offset)
        this.confidence = json_data.confidence

        this.frames = []

        json_data.frames.forEach(frame => {
            this.frames.push(new Text_Frame(frame, video_height, video_width))
        })

    }

    has_frames_for_time(seconds) {
        return ((this.start_time <= seconds) && (this.end_time >= seconds))
    }


    most_recent_real_poly(seconds) {

        for (let index = 0; index < this.frames.length; index++) {
            if (this.frames[index].time_offset > seconds) {
                if (index > 0)
                    return this.frames[index - 1].poly
                else
                    return null
            }
        }
        return null
    }

    most_recent_interpolated_poly(seconds) {

        for (let index = 0; index < this.frames.length; index++) {
            if (this.frames[index].time_offset > seconds) {
                if (index > 0) {
                    if ((index == 1) || (index == this.frames.length - 1))
                        return this.frames[index - 1].box

                    // create a new interpolated box 
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

    current_bounding_box(seconds, interpolate = false) {

        if (interpolate)
            return this.most_recent_interpolated_poly(seconds)
        else
            return this.most_recent_real_poly(seconds)
    }

}



class Text_Detection {
    constructor(json_data, video_height, video_width) {

        this.text = json_data.text

        this.segments = []

        json_data.segments.forEach(segment => {
            const new_segemnt = new Text_Segment(segment, video_height, video_width)
            this.segments.push(new_segemnt)
        })
    }

    has_frames_for_time(seconds) {

        for (let index = 0; index < this.segments.length; index++) {
            if (this.segments[index].has_frames_for_time(seconds))
                return true
        }
        return false
    }



    current_bounding_box(seconds, interpolate = false) {

        for (let index = 0; index < this.segments.length; index++) {
            if(this.segments[index].has_frames_for_time(seconds))
                return this.segments[index].current_bounding_box(seconds)
        }

        return null
    }

}