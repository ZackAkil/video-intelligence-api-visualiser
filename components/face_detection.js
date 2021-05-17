// define style rules to be programtically loaded
var style = document.createElement('style');
style.innerHTML = `

.face{
    display: inline-block;
    width: 231px;
    margin: 10px;
    text-align: left;
    background-color: #f7f7f7;
    padding: 10px;
    cursor:pointer;
}

.face > img{
    height: 85px;
    margin: auto;
    display: block;
}

.bar-chart{

}

.bar-chart > div{
    background-color: #4285F4;
    height:1em;
}

`;
document.getElementsByTagName('head')[0].appendChild(style);



Vue.component('bar-chart', {
    props: ['label', 'percent'],
    computed: {
        has_data: function () {
            return this.detected_features.includes(this.data_id)
        },
        bar_style: function () {
            return {
                color: '#4285F4',
                width: this.percent.toString() + '%'
            }
        },
    },
    template: `
            <div class="bar-chart">
                {{label}} - {{parseInt(percent)}}%
                <div class="bar" v-bind:style="bar_style"> </div>
            </div>
            `
})



// define component
Vue.component('face-detection-viz', {
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
        face_tracks: function () {
            `
            Extract just the face detection data from json
            `

            if (!this.json_data.annotation_results)
                return []

            for (let index = 0; index < this.json_data.annotation_results.length; index++) {
                if ('face_detection_annotations' in this.json_data.annotation_results[index])
                    return this.json_data.annotation_results[index].face_detection_annotations
            }
            return []
        },

        indexed_face_tracks: function () {
            `
            Create a clean list of face detection data with realisied nullable fields 
            and scaled bounding boxes ready to be drawn by the canvas
            `

            const indexed_tracks = []

            if (!this.face_tracks)
                return []

            this.face_tracks.forEach(element => {
                if (element.tracks[0].confidence > this.confidence_threshold)
                    indexed_tracks.push(new Face_Track(element, this.video_info.height, this.video_info.width))
            })

            return indexed_tracks
        },

        object_track_segments: function () {
            ` 
            create the list of cronological time segments that represent just when objects are present on screen
            `
            const segments = { 'face': { 'segments': [], 'count': 0 } }

            this.indexed_face_tracks.forEach(object_tracks => {

                segments['face'].count++

                var added = false

                for (let index = 0; index < segments['face'].length; index++) {

                    const segment = segments['face'].segments[index]
                    if (object_tracks.start_time < segment[1]) {
                        segments['face'].segments[index][1] = Math.max(segments['face'].segments[index][1], object_tracks.end_time)
                        added = true
                        break
                    }
                }

                if (!added)
                    segments['face'].segments.push([object_tracks.start_time, object_tracks.end_time])
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
        segment_clicked: function (seconds) {
            this.$emit('segment-clicked', { seconds: seconds })
        }
    },
    template: `
    <div calss="object-tracking-container">

        <div class="confidence">
            <span>Confidence threshold</span>
            <input type="range" min="0.0" max="1" value="0.5" step="0.01" v-model="confidence_threshold">
            <span class="confidence-value">{{confidence_threshold}}</span>
        </div>

        <div class="data-warning" v-if="face_tracks.length == 0"> No face detection data in JSON</div>

        <div class="segment-container" v-for="segments, key in object_track_segments" v-bind:key="key + 'z'">
                <div class="label">{{key}} ({{segments.count}})</div>
                <div class="segment-timeline">
                    <div class="segment" v-for="segment in segments.segments" 
                                        v-bind:style="segment_style(segment)" 
                                        v-on:click="segment_clicked(segment[0])"
                    ></div>
                </div>
        </div>


        <transition-group name="segments" tag="div">
      
                <div class="face "  v-for="face in indexed_face_tracks" v-on:click="segment_clicked(face.start_time)" v-bind:key="face.thumbnail">
                    <img v-bind:src="'data:image/png;base64, ' +  face.thumbnail" > </img>
                    <div>
                        <bar-chart v-bind:label="'Glasses'" v-bind:percent="face.attributes.glasses*100"></bar-chart>
                        <bar-chart v-bind:label="'Eyes visible'" v-bind:percent="face.attributes.eyes_visible*100"></bar-chart>
                        <bar-chart v-bind:label="'Headwear'" v-bind:percent="face.attributes.headwear*100"></bar-chart>
                        <bar-chart v-bind:label="'Looking at camera'" v-bind:percent="face.attributes.looking_at_camera*100"></bar-chart>
                        <bar-chart v-bind:label="'Mouth open'" v-bind:percent="face.attributes.mouth_open*100"></bar-chart>
                        <bar-chart v-bind:label="'Smiling'" v-bind:percent="face.attributes.smiling*100"></bar-chart>
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
            const object_tracks = component.indexed_face_tracks

            draw_bounding_boxes(object_tracks, ctx)

        }, 1000 / this.frame_rate)
    },
    beforeDestroy: function () {
        console.log('destroying component')
        clearInterval(this.interval_timer)
        this.ctx.clearRect(0, 0, 800, 500)
    }
})

// define component




class Face_Frame {
    constructor(json_data, video_height, video_width) {

        this.time_offset = nullable_time_offset_to_seconds(json_data.time_offset)

        this.box = {
            'x': (json_data.normalized_bounding_box.left || 0) * video_width,
            'y': (json_data.normalized_bounding_box.top || 0) * video_height,
            'width': ((json_data.normalized_bounding_box.right || 0) - (json_data.normalized_bounding_box.left || 0)) * video_width,
            'height': ((json_data.normalized_bounding_box.bottom || 0) - (json_data.normalized_bounding_box.top || 0)) * video_height
        }

        // this.landmarks = {
        //     nose: null, left_eye: null, right_eye: null, left_ear: null, right_ear: null, left_shoulder: null,
        //     right_shoulder: null, left_elbow: null, right_elbow: null, left_wrist: null, right_wrist: null,
        //     left_hip: null, right_hip: null, left_knee: null, right_knee: null, left_ankle: null, right_ankle: null
        // }

        // if (json_data.landmarks)
        //     json_data.landmarks.forEach(landmark => {
        //         this.landmarks[landmark.name] = { 'x': landmark.point.x * video_width, 'y': landmark.point.y * video_height }
        //     })
    }
}



class Face_Track {
    constructor(json_data, video_height, video_width) {
        const track = json_data.tracks[0]
        this.start_time = nullable_time_offset_to_seconds(track.segment.start_time_offset)
        this.end_time = nullable_time_offset_to_seconds(track.segment.end_time_offset)
        this.confidence = track.confidence
        this.thumbnail = json_data.thumbnail
        this.attributes = {}

        track.attributes.forEach(attribute => {
            this.attributes[attribute.name] = attribute.confidence
        })


        this.frames = []

        track.timestamped_objects.forEach(frame => {
            const new_frame = new Face_Frame(frame, video_height, video_width)
            this.frames.push(new_frame)
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

    current_bounding_box(seconds, interpolate = true) {

        if (interpolate)
            return this.most_recent_interpolated_bounding_box(seconds)
        else
            return this.most_recent_real_bounding_box(seconds)
    }
}