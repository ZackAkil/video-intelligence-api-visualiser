// define style rules to be programtically loaded
var style = document.createElement('style');
style.innerHTML = `

.speech-transcription-container{
    text-align:left;
}
`;
document.getElementsByTagName('head')[0].appendChild(style);


// define component
Vue.component('speech-transcription-viz', {
    props: ['json_data', 'video_info'],
    data: function () {
        return {
            interval_timer: null,
            current_time: 0
        }
    },
    computed: {
        detected_speech: function () {
            `
            Extract just the speech transcriptions data from json
            `
            if (!this.json_data.annotation_results)
                return []

            for (let index = 0; index < this.json_data.annotation_results.length; index++) {
                if ('speech_transcriptions' in this.json_data.annotation_results[index])
                    return this.json_data.annotation_results[index].speech_transcriptions
            }
            return []
        },

        indexed_speech: function () {
            `
            Create a clean object of speech
            `

            const indexed_speech = []
            
            if (this.detected_speech) {

                this.detected_speech.forEach(element => {
                    const detected_speech = new Detected_Speech(element)
                    indexed_speech.push(detected_speech)
                    // if (detected_label.segments.length > 0)
                    //     indexed_segments.push(detected_label)
                })
            }

            return indexed_speech
        },
    },
    methods: {
        // segment_style: function (segment) {
        //     return {
        //         left: ((segment.start_time / this.video_info.length) * 100).toString() + '%',
        //         width: (((segment.end_time - segment.start_time) / this.video_info.length) * 100).toString() + '%'
        //     }
        // },
        word_clicked: function (word_data) {
            this.$emit('word-clicked', { seconds: word_data.start_time })
        },
        // label_on_screen: function (label) {
        //     return label.has_segment_for_time(this.current_time)
        // }
    },
    template: `
    <div class="speech-transcription-container">

    <div class="data-warning" v-if="detected_speech.length == 0"> No shot data in JSON</div>

        <p v-for="speech in indexed_speech" v-on:click="word_clicked(shot)"> {{speech.text}} </p>

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


class Detected_Speech {
    constructor(json_data) {
        this.text = json_data.alternatives[0].transcript
        // this.end_time = nullable_time_offset_to_seconds(json_data.end_time_offset)
    }

    within_time(seconds) {
        return ((this.start_time <= seconds) && (this.end_time >= seconds))
    }

}