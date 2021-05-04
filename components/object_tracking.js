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
        }
    },
    template: `
    <div>
        <h3>Object tracking</h3>
        <p v-for="item in object_tracks">This is my item : {{item}}</p>
    </div>
    `
})