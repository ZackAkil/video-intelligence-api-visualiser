// define style rules to be programtically loaded
var style = document.createElement('style');
style.innerHTML = `


`;
document.getElementsByTagName('head')[0].appendChild(style);


// define component
Vue.component('explicit-content-detection-viz', {
    props: ['json_data', 'video_info'],
    data: function () {
        return {
            interval_timer: null,
            current_time: 0
        }
    },
    computed: {
        explicit_frames_annotations: function () {
            `
            Extract just the explicit detection data from json
            `
            if (!this.json_data.annotation_results)
                return []

            for (let index = 0; index < this.json_data.annotation_results.length; index++) {
                if ('explicit_annotation' in this.json_data.annotation_results[index])
                    return this.json_data.annotation_results[index].explicit_annotation
            }
            return []
        },

        indexed_explicit_frames_annotations: function () {
            `
            Create a clean list of explicit content detetcion frames
            `

            const indexed_shots = []

            if (this.explicit_frames_annotations) {

                this.explicit_frames_annotations.frames.forEach(element => {
                    const explicit_detection = new Explicit_Content_Detection(element)
                    indexed_shots.push(explicit_detection)
                })
            }

            return indexed_shots
        },
    },
    methods: {
        // segment_style: function (segment) {
        //     return {
        //         left: ((segment.start_time / this.video_info.length) * 100).toString() + '%',
        //         width: (((segment.end_time - segment.start_time) / this.video_info.length) * 100).toString() + '%'
        //     }
        // },
        shot_clicked: function (shot_data) {
            this.$emit('shot-clicked', { seconds: shot_data.time_offset })
        },
        // label_on_screen: function (label) {
        //     return label.has_segment_for_time(this.current_time)
        // }
    },
    template: `
    <div calss="shot_detection-container">

    <div class="data-warning" v-if="explicit_frames_annotations.length == 0"> No shot data in JSON</div>

    <div v-for="shot in indexed_explicit_frames_annotations" 
    v-on:click="shot_clicked(shot)"> {{shot.time_offset}} -> {{shot.explicit_liklyhood}}</div>

    </div>
    `,
    mounted: function () {
        console.log('mounted component')

        // const component = this

        // this.interval_timer = setInterval(function () {
        //     component.current_time = video.currentTime
        // }, 1000 / 10)
    },
    beforeDestroy: function () {
        console.log('destroying component')
        // clearInterval(this.interval_timer)
    }
})


class Explicit_Content_Detection {
    constructor(json_data) {
        this.time_offset = nullable_time_offset_to_seconds(json_data.time_offset)
        this.explicit_liklyhood = json_data.pornography_likelihood
    }

    // within_time(seconds) {
    //     return ((this.start_time <= seconds) && (this.end_time >= seconds))
    // }

}