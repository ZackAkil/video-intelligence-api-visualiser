// define style rules to be programtically loaded
var style = document.createElement('style');
style.innerHTML = `



`;
document.getElementsByTagName('head')[0].appendChild(style);


// define component
Vue.component('object-tracking-viz', {
    props: ['json_data', 'video_height', 'video_width'],
    data: function () {
        return {
        }
    },
    computed: {
        object_tracks: function () {

            if (!this.json_data.annotation_results)
                return []

            for (let index = 0; index < this.json_data.annotation_results.length; index++) {
                if ('object_annotations' in this.json_data.annotation_results[index])
                    return this.json_data.annotation_results[index].object_annotations
            }
            return []
        },

        indexed_object_tracks: function () {
            // realise the time stamps and bound box coordinates

            const indexed_tracks = []

            if (!this.object_tracks)
                return []

            this.object_tracks.forEach(element => {
                if (element.confidence > 0.6)
                    indexed_tracks.push(new Object_Track(element, this.video_height, this.video_width))
            })

            return indexed_tracks
        },

        object_track_segments: function () {

            // return {}

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
    template: `
    <div>
        <h3>Object tracking</h3>
        <p v-for="item, key in object_track_segments">This is my item : {{key}}, {{item}}</p>
    </div>
    `,
    mounted: function () {
        var canvas = document.getElementById("my_canvas")
        var ctx = canvas.getContext("2d")
        ctx.strokeStyle = "#FF0000"

        ctx.beginPath()
        ctx.rect(20, 20, 150, 100)
        ctx.stroke()

        ctx.beginPath();
        ctx.rect(20, 20, 150, 100);
        ctx.fillStyle = "red";
        ctx.fill();



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
    ctx.strokeStyle = "#000000"
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