function draw_bounding_boxes(object_tracks, ctx) {
    ctx.clearRect(0, 0, 800, 500)

    const current_time = video.currentTime

    object_tracks.forEach(tracked_object => {

        if (tracked_object.has_frames_for_time(current_time)) {
            draw_bounding_box(tracked_object.current_bounding_box(current_time), tracked_object.name, ctx)
        }

    })
}

function draw_bounding_box(box, name = null, ctx) {
    ctx.strokeStyle = "#4285F4"
    ctx.beginPath()
    ctx.lineWidth = 3
    ctx.rect(box.x, box.y, box.width, box.height)
    ctx.stroke()

    if (name) {
        ctx.fillStyle = "#4285F4"
        ctx.fillRect(box.x, box.y, name.length * 13, 32)
        ctx.fillStyle = "#ffffff"
        ctx.fillText(name, box.x + 5, box.y + 22)
    }
}

function nullable_time_offset_to_seconds(time_offset) {
    if (!time_offset)
        return 0

    var seconds = time_offset.seconds || 0
    seconds += time_offset.nanos / 10e8 || 0
    return seconds
}

