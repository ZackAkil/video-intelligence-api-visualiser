// define style rules to be programtically loaded
var style = document.createElement('style');
style.innerHTML = `

.current-likelihood{
    width:150px;
    display: inline-block;
}
`;
document.getElementsByTagName('head')[0].appendChild(style);


// define component
Vue.component('explicit-content-detection-viz', {
    props: ['json_data', 'video_info'],
    data: function () {
        return {
            interval_timer: null,
            current_time: 0,
            likelihoods: ['VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY']
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
                    return this.json_data.annotation_results[index].explicit_annotation.frames
            }
            return []
        },

        indexed_explicit_frames_annotations: function () {
            `
            Create a clean list of explicit content detetcion frames
            `

            const indexed_shots = []

            this.explicit_frames_annotations.forEach(element => {
                const explicit_detection = new Explicit_Content_Detection(element)
                indexed_shots.push(explicit_detection)
            })

            return indexed_shots
        },

        likelihood_segments: function () {
            `
            Create a clean list of explicit content detetcion segments
            `
            const segments = {
                'VERY_LIKELY': { 'segments': [], 'count': 0 },
                'LIKELY': { 'segments': [], 'count': 0 },
                'POSSIBLE': { 'segments': [], 'count': 0 },
                'UNLIKELY': { 'segments': [], 'count': 0 },
                'VERY_UNLIKELY': { 'segments': [], 'count': 0 },
            }

            this.indexed_explicit_frames_annotations.forEach(shot => {

                segments[shot.explicit_liklyhood].segments.push(shot.time_offset)

            })

            return segments
        },
        current_likelihood :function (){

            for (let index = 0; index < this.indexed_explicit_frames_annotations.length; index++) {
                const element = this.indexed_explicit_frames_annotations[index]
                if (element.time_offset > this.current_time)
                    return this.indexed_explicit_frames_annotations[ Math.max(index - 1, 0 )].explicit_liklyhood
            }

            return ''
        }
    },
    methods: {
        segment_style: function (segment) {
            return {
                left: ((segment / this.video_info.length) * 100).toString() + '%',
                width: '5px'
            }
        },
        shot_clicked: function (shot_data) {
            this.$emit('shot-clicked', { seconds: shot_data })
        }
    },
    template: `
    <div calss="shot_detection-container">

    <div class="data-warning" v-if="explicit_frames_annotations.length == 0"> No explicit content detection data in JSON</div>

    <div>Current explicit content likelihood : <span class="current-likelihood">{{current_likelihood}}</span> </div>
    <br>

    <div class="segment-container" v-for="segments, key in likelihood_segments" v-bind:key="key + 'z'">
                <div class="label">{{key}}</div>
                <div class="segment-timeline">
                    <div class="segment" v-for="segment in segments.segments" 
                                        v-bind:style="segment_style(segment)" 
                                        v-on:click="shot_clicked(segment)"
                    ></div>
                </div>
            </div>

    </div>
    `,
    mounted: function () {
        console.log('mounted component')

        const component = this

        this.interval_timer = setInterval(function () {
            component.current_time = video.currentTime
        }, 1000 / 10)
    },
    beforeDestroy: function () {
        console.log('destroying component')
        clearInterval(this.interval_timer)
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