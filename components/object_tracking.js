// define style rules to be programtically loaded
var style = document.createElement('style');
style.innerHTML = `

.segment-timeline{
    
    width: 100%;
    position: relative; 
    height: 1em;
}

.segment-container{
    text-align: center;
    margin:2px;
}

.segment{
    position: absolute; 
    background-color: #4285F4;
    height: 1em;
    border-radius: 5px;
    min-width: 5px;
    cursor: pointer;
}

.label{
    display: inline-block;
    background-color:  #4285F4;
    color: white;
    padding: 5px;
    font-size: 1.1em;
    vertical-align: middle;
    width: 10%;
    min-width: 190px;
    border-radius: 5px;
}



.segment-timeline{
    display: inline-block;
    vertical-align: middle;
    width: 80%;
    background-color: #f5f5f5;
    padding: 5px;
    border-radius: 5px;
}

`;
document.getElementsByTagName('head')[0].appendChild(style);


// define component
Vue.component('object-tracking-viz', {
    props: ['json_data', 'video_height', 'video_width', 'video_length'],
    data: function () {
        return {
            confidence_threshold : 0.5
        }
    },
    computed: {
        object_tracks: function () {
            `
            Extract just the object tracking data from json
            `

            if (!this.json_data.annotation_results)
                return []

            for (let index = 0; index < this.json_data.annotation_results.length; index++) {
                if ('object_annotations' in this.json_data.annotation_results[index])
                    return this.json_data.annotation_results[index].object_annotations
            }
            return []
        },

        indexed_object_tracks: function () {
            `
            Create a clean list of object tracking data with realisied nullable fields 
            and scaled bounding boxes ready to be drawn by the canvas
            `

            const indexed_tracks = []

            if (!this.object_tracks)
                return []

            this.object_tracks.forEach(element => {
                if (element.confidence > this.confidence_threshold)
                    indexed_tracks.push(new Object_Track(element, this.video_height, this.video_width))
            })

            return indexed_tracks
        },

        object_track_segments: function () {
            ` 
            create the list of cronological time segments that represent just when objects are present on screen
            `
            const segments = {}

            this.indexed_object_tracks.forEach(object_tracks => {

                if (!(object_tracks.name in segments))
                    segments[object_tracks.name] = []

                var added = false

                for (let index = 0; index < segments[object_tracks.name].length; index++) {
                    const segment = segments[object_tracks.name][index]
                    if (object_tracks.start_time < segment[1]) {
                        segments[object_tracks.name][index][1] = Math.max(segments[object_tracks.name][index][1], object_tracks.end_time)
                        added = true
                        break
                    }
                }

                if (!added)
                    segments[object_tracks.name].push([object_tracks.start_time, object_tracks.end_time])
            })

            return segments
        }
    },
    methods: {
        segment_style: function (segment) {
            return {
                left: ((segment[0] / this.video_length) * 100).toString() + '%',
                width: (( (segment[1] - segment[0]) / this.video_length) * 100).toString() + '%'
            }
        },
        segment_clicked:function(segment_data){
            this.$emit('segment-clicked', {seconds : segment_data[0]})
        }
    },
    template: `
    <div calss="object-tracking-container">
        <input type="range" min="0.5" max="1" value="0.5" step="0.01" v-model="confidence_threshold">
        {{confidence_threshold}}
        <div class="segment-container" v-for="segments, key in object_track_segments">
            <div class="label">{{key}}</div>
            <div class="segment-timeline">
                <div class="segment" v-for="segment in segments" 
                                    v-bind:style="segment_style(segment)" 
                                    v-on:click="segment_clicked(segment)"
                ></div>
            </div>
        </div>
    </div>
    `,
    mounted: function () {
        var canvas = document.getElementById("my_canvas")
        var ctx = canvas.getContext("2d")

        var time_update_interval = setInterval(function () {
            const object_tracks = document.querySelector('#object_tracks').__vue__.indexed_object_tracks
            draw_bounding_boxes(object_tracks, ctx)
        }, 1000 / 30)
    }
})


function draw_bounding_boxes(object_tracks, ctx) {
    ctx.clearRect(0, 0, 500, 500)

    const current_time = video.currentTime

    object_tracks.forEach(tracked_object => {

        if (tracked_object.has_frames_for_time(current_time)) {
            draw_bounding_box(tracked_object.current_bounding_box(current_time), ctx)
        }

    })
}

function draw_bounding_box(box, ctx) {
    ctx.strokeStyle = "#4285F4"
    ctx.beginPath()
    ctx.rect(box.x, box.y, box.width, box.height)
    ctx.stroke()
}


function nullable_time_offset_to_seconds(time_offset) {
    var seconds = time_offset.seconds || 0
    seconds += time_offset.nanos / 10e8 || 0
    return seconds
}


class Object_Track {
    constructor(json_data, video_height, video_width) {
        this.name = json_data.entity.description
        this.start_time = nullable_time_offset_to_seconds(json_data.segment.start_time_offset)
        this.end_time = nullable_time_offset_to_seconds(json_data.segment.end_time_offset)

        this.frames = []

        json_data.frames.forEach(frame => {
            const new_frame = {
                'box': {
                    'x': (frame.normalized_bounding_box.left || 0) * video_width,
                    'y': (frame.normalized_bounding_box.top || 0) * video_height,
                    'width': ((frame.normalized_bounding_box.right || 0) - (frame.normalized_bounding_box.left || 0)) * video_width,
                    'height': ((frame.normalized_bounding_box.bottom || 0) - (frame.normalized_bounding_box.top || 0)) * video_height
                },
                'time_offset': nullable_time_offset_to_seconds(frame.time_offset)
            }
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