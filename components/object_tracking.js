// define style rules to be programtically loaded
var style = document.createElement('style');
style.innerHTML = `



`;
document.getElementsByTagName('head')[0].appendChild(style);


// define component
Vue.component('object-tracking-viz', {
    props: ['json_data'],
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
                indexed_tracks.push(new Object_Track(element))
            })

            return indexed_tracks
        }
    },
    template: `
    <div>
        <h3>Object tracking</h3>
        <p v-for="item in object_tracks">This is my item : {{item}}</p>
    </div>
    `
})

// var time_update_interval = setInterval(function () {
//     updateTimerDisplay();
// }, 1000)


function nullable_time_offset_to_seconds(time_offset) {
    var seconds = time_offset.seconds || 0
    seconds += time_offset.nanos / 10e8 || 0
    return seconds
}


class Object_Track {
    constructor(json_data) {
        this.name = json_data.entity.description
        this.start_time = nullable_time_offset_to_seconds(json_data.segment.start_time_offset)
        this.end_time = nullable_time_offset_to_seconds(json_data.segment.end_time_offset)

        this.frames = []

        json_data.frames.forEach(frame => {
            const new_frame = {
                'box': {
                    'left': frame.normalized_bounding_box.left || 0,
                    'right': frame.normalized_bounding_box.right || 0,
                    'top': frame.normalized_bounding_box.top || 0,
                    'bottom': frame.normalized_bounding_box.bottom || 0
                },
                'time_offset': nullable_time_offset_to_seconds(frame.time_offset)
            }
            this.frames.push(new_frame)
        })
    }


    current_bounding_box(seconds){

        for (let index = 0; index < this.frames.length; index++) {
            if (this.frames[index].time_offset > seconds){
                if (index > 0)
                    return this.frames[index - 1]
                else
                    return null
            }
        }
        return null
    }
}