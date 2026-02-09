const BlurCirlce = ({ top = 'auto', left = 'auto', right = 'auto', bottom = 'auto' }) => {
    return (
        <div className="absolute -z-50 h-38 w-38 aspect-square rounded-full bg-primary/30 blur-3xl" style={{ top: top, left: left, right: right, bottom: bottom }}></div>
    )
}

export default BlurCirlce