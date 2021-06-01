// define style rules to be programtically loaded
var style = document.createElement('style');
style.innerHTML = `

.text-detected{
    display: inline-block;
    margin: 5px;
    border: solid #F4B400 2px;
    padding: 5px;
    border-radius: 5px;
}

.time-pill{
    color: black;
    background-color: #F4B400;
    border-radius: 10px;
    padding: 0px 4px;
    margin: 1px;
    display: inline-block;
    cursor: pointer;
}

.time-pill:hover{
    color: white;
}

`;
document.getElementsByTagName('head')[0].appendChild(style);


// define component
Vue.component('text-detection-viz', {
    props: ['json_data', 'video_info'],
    data: function () {
        return {
            confidence_threshold: 0.5,
            current_time: 0,
            interval_timer: null,
            interval_timer_current_text: null,
            interval_timer_current_text_frame_rate: 10,
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
                const text_detection = new Text_Detection(element, this.video_info.height, this.video_info.width, this.confidence_threshold)
                if (text_detection.segments.length)
                    indexed_tracks.push(text_detection)
            })


            indexed_tracks.sort((a, b) => (a.start_time > b.start_time) ? 1 : -1)

            return indexed_tracks
        },

        current_indexed_text_tracks: function () {
            ` 
            create the list of cronological time segments that represent just when objects are present on screen
            `
            const detected_text = []

            if (indexed_text_tracks) {

                indexed_text_tracks.forEach(element => {
                    if (element.has_frames_for_time(this.current_time))
                        detected_text.push(element)
                })

            }

            return detected_text
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

        <div class="data-warning" v-if="text_tracks.length == 0"> No face detection data in JSON</div>


        <div class="current_labels">
        <p>Detected text on screen:</p>
            <div v-for="text in indexed_text_tracks" v-bind:key="text.id" v-if="text.has_frames_for_time(current_time)">{{text.text}}</div>
        </div>

        
        <div>
        <p>All detected text:</p>
            <div class="text-detected" v-for="text in indexed_text_tracks">
                {{text.text}}

                
                    <span class="time-pill" 
                        v-for="segment in text.segments" 
                        v-on:click="segment_clicked(segment.start_time)" 
                    >
                        {{parseInt(segment.start_time)}}s
                    </span>
                
        
            </div>
        </div>
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
            // console.log('running')
            const object_tracks = component.indexed_text_tracks

            draw_bounding_polys(object_tracks, ctx)

        }, 1000 / this.frame_rate)



        this.interval_timer_current_text = setInterval(function () {
            // console.log('running')
            component.current_time = video.currentTime

        }, 1000 / this.interval_timer_current_text_frame_rate)
    },
    beforeDestroy: function () {
        console.log('destroying component')
        clearInterval(this.interval_timer)
        clearInterval(this.interval_timer_current_text)
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





class Text_Frame {
    constructor(json_data, video_height, video_width) {

        this.time_offset = nullable_time_offset_to_seconds(json_data.time_offset)

        this.poly = []

        json_data.rotated_bounding_box.vertices.forEach(vertex => {
            this.poly.push({ x: vertex.x * video_width, y: vertex.y * video_height })
        })

    }

    toString() {
        var output = ''
        this.poly.forEach(point => {
            output += point.x.toString() + point.y.toString()
        })
        return output
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
                        return this.frames[index - 1].poly

                    // create a new interpolated box 
                    const start_poly = this.frames[index - 1]
                    const end_poly = this.frames[index]
                    const time_delt_ratio = (seconds - start_poly.time_offset) / (end_poly.time_offset - start_poly.time_offset)

                    const interpolated_poly = []

                    for (let i = 0; i < 4; i++) {
                        interpolated_poly.push({
                            x: start_poly.poly[i].x + (end_poly.poly[i].x - start_poly.poly[i].x) * time_delt_ratio,
                            y: start_poly.poly[i].y + (end_poly.poly[i].y - start_poly.poly[i].y) * time_delt_ratio
                        })
                    }

                    return interpolated_poly

                } else
                    return null
            }
        }
        return null
    }

    current_bounding_box(seconds, interpolate = true) {

        if (interpolate)
            return this.most_recent_interpolated_poly(seconds)
        else
            return this.most_recent_real_poly(seconds)
    }

}



class Text_Detection {
    constructor(json_data, video_height, video_width, confidence_threshold) {

        this.text = json_data.text
        this.segments = []

        json_data.segments.forEach(segment => {
            const new_segemnt = new Text_Segment(segment, video_height, video_width)
            if (new_segemnt.confidence > confidence_threshold)
                this.segments.push(new_segemnt)
        })

        if (this.segments.length) {
            this.start_time = this.segments[0].start_time
            this.end_time = this.segments[this.segments.length - 1].end_time
            this.start_poly = this.segments[0].frames[0]
            this.id = this.start_time.toString() + this.end_time.toString() + this.start_poly.toString()
        }
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
            if (this.segments[index].has_frames_for_time(seconds))
                return this.segments[index].current_bounding_box(seconds)
        }

        return null
    }

}