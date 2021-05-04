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
                indexed_tracks.push(new Object_Track(element, this.video_height, this.video_width))
            })

            return indexed_tracks
        }
    },
    template: `
    <div>
        <h3>Object tracking</h3>
        <p v-for="item in object_tracks">This is my item : {{item}}</p>
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
            const object_tracks =  document.querySelector('#object_tracks').__vue__.indexed_object_tracks
            console.log('intevrkjabks', object_tracks)
            draw_bounding_boxes(object_tracks, ctx)
        }, 1000 / 30)
    }
})


function draw_bounding_boxes(object_tracks, ctx) {
    console.log(video.currentTime)
    ctx.clearRect(0, 0, 500, 500)

    const current_time = video.currentTime

    object_tracks.forEach(tracked_object => {

        if (tracked_object.has_frames_for_time(current_time)){
            console.log('drawing box for ', tracked_object)
            draw_bounding_box(tracked_object.current_bounding_box(current_time), ctx)
        }

    })
}

function draw_bounding_box(box, ctx) {
    console.log('drawing', box)
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

    current_bounding_box(seconds) {

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
}