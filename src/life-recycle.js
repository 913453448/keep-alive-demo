export default {
    computed: {
        name(){
            return this.$options.name;
        }
    },
    created(){
        console.log("created--->"+this.name);
    },
    activated() {
        console.log("activated--->"+this.name);
    },
    deactivated() {
        console.log("deactivated--->"+this.name);
    },
    destroyed() {
        console.log("destoryed--->"+this.name);
    }
}