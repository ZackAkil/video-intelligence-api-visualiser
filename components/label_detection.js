// define style rules to be programtically loaded
var style = document.createElement('style');
style.innerHTML = `

.current_labels > div{
    display: inline-block;
    margin: 5px;
    background-color: white;
    border-radius: 5px;
    padding:5px;
}

.current_labels{
    min-height: 45px;
}

`;
document.getElementsByTagName('head')[0].appendChild(style);


// define component
Vue.component('label-detection-viz', {
    props: ['json_data', 'video_info'],
    data: function () {
        return {
            confidence_threshold: 0.0,
            interval_timer: null,
            current_time: 0
        }
    },
    computed: {
        detected_labels: function () {
            `
            Extract just the object tracking data from json
            `
            if (!this.json_data.annotation_results)
                return []

            for (let index = 0; index < this.json_data.annotation_results.length; index++) {
                if ('shot_label_annotations' in this.json_data.annotation_results[index])
                    return this.json_data.annotation_results[index].shot_label_annotations
            }
            return []
        },

        indexed_detected_labels: function () {
            `
            Create a clean list of label detection segments realisied nullable fields 
            `

            const indexed_segments = []

            if (!this.detected_labels)
                return []

            this.detected_labels.forEach(element => {
                const detected_label = new Detected_Label(element, this.confidence_threshold)
                if (detected_label.segments.length > 0)
                    indexed_segments.push(detected_label)
            })

            return indexed_segments
        },
    },
    methods: {
        segment_style: function (segment) {
            return {
                left: ((segment.start_time / this.video_info.length) * 100).toString() + '%',
                width: (((segment.end_time - segment.start_time) / this.video_info.length) * 100).toString() + '%'
            }
        },
        segment_clicked: function (segment_data) {
            this.$emit('segment-clicked', { seconds: segment_data.start_time -0.5})
        },
        label_on_screen: function (label) {
            return label.has_segment_for_time(this.current_time)
        }
    },
    template: `
    <div calss="label-detection-container">

        <div class="confidence">
            <span>Confidence threshold</span>
            <input type="range" min="0.0" max="1" value="0.5" step="0.01" v-model="confidence_threshold">
            <span class="confidence-value">{{confidence_threshold}}</span>
        </div>

        <div class="data-warning" v-if="detected_labels.length == 0"> No label data in JSON</div>


        <div class="current_labels">
            <div class="mdl-shadow--2dp" v-for="label in indexed_detected_labels" v-bind:key="label.name" v-if="label_on_screen(label)">{{label.name}}</div>
        </div>

        <transition-group name="segments" tag="div">
            
            <div class="segment-container" v-for="label in indexed_detected_labels" v-bind:key="label.name">
                <div class="label">{{label.name}}</div>
                <div class="segment-timeline">
                    <div class="segment" v-for="segment in label.segments" 
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

        const component = this

        this.interval_timer = setInterval(function () {
            component.current_time = video.currentTime
        }, 1000 / 10)
    },
    beforeDestroy: function () {
        console.log('destroying component')
        // clearInterval(this.interval_timer)
    }
})



class Detected_Label_Segment {
    constructor(segment) {
        this.confidence = segment.confidence
        this.start_time = nullable_time_offset_to_seconds(segment.segment.start_time_offset)
        this.end_time = nullable_time_offset_to_seconds(segment.segment.end_time_offset)
    }

    within_time(seconds) {
        return ((this.start_time <= seconds) && (this.end_time >= seconds))
    }
}


class Detected_Label {
    constructor(json_data, confidence_threshold) {
        this.name = ""
        if (json_data.category_entities)
            this.name += json_data.category_entities[0].description + ' '


        this.name += json_data.entity.description
        this.segments = []
        this.highest_segment_confidence = 0

        json_data.segments.forEach(segment => {
            if (segment.confidence > confidence_threshold) {
                this.segments.push(new Detected_Label_Segment(segment))
                this.highest_segment_confidence = Math.max(this.highest_segment_confidence, segment.confidence)
            }
        })
    }


    has_segment_for_time(seconds) {

        for (let index = 0; index < this.segments.length; index++) {
            if (this.segments[index].within_time(seconds))
                return true
        }
        return false
    }

}